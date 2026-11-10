import { v, ConvexError } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { account, accessProfile } from "./access";
import { carePatient, careStaff, audit, clean } from "./careAccess";
import { invoiceValue, paymentFields } from "./careValues";
const paymentValue = v.object({
  _id: v.id("mobileMoneyPayments"),
  _creationTime: v.number(),
  ...paymentFields,
});
export const enabled = () =>
  process.env.PAWAPAY_ENVIRONMENT === "production" &&
  process.env.PAWAPAY_CHECKOUT_ENABLED === "true" &&
  !!process.env.PAWAPAY_API_TOKEN?.trim();
export const configuration = query({
  args: {},
  returns: v.object({ enabled: v.boolean() }),
  handler: async (ctx) => {
    await account(ctx);
    return { enabled: enabled() };
  },
});
export const invoices = query({
  args: {
    profileId: v.optional(v.id("profiles")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      invoice: invoiceValue,
      patient: v.string(),
      paymentState: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.profileId) await accessProfile(ctx, args.profileId);
    else await careStaff(ctx);
    const role = args.profileId ? null : await careStaff(ctx);
    const rows = args.profileId
      ? await ctx.db
          .query("careInvoices")
          .withIndex("by_profile", (q) => q.eq("profileId", args.profileId!))
          .order("desc")
          .paginate(args.paginationOpts)
      : role!.administrator
        ? await ctx.db
            .query("careInvoices")
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("careInvoices")
            .withIndex("by_clinician", (q) =>
              q.eq("clinicianId", role!.clinician!._id),
            )
            .order("desc")
            .paginate(args.paginationOpts);
    // Clinician access is revoked immediately when assignment ends.
    const allowed = [];
    for (const row of rows.page) {
      if (role && !role.administrator) {
        const a = await ctx.db
          .query("careAssignments")
          .withIndex("by_profile_clinician", (q) =>
            q
              .eq("profileId", row.profileId)
              .eq("clinicianId", role.clinician!._id),
          )
          .unique();
        if (!a?.active) continue;
      }
      allowed.push(row);
    }
    return {
      ...rows,
      page: await Promise.all(
        allowed.map(async (row) => ({
          invoice: row,
          patient: (await ctx.db.get(row.profileId))?.name ?? "Patient",
          paymentState: row.activePaymentId
            ? (await ctx.db.get(row.activePaymentId))?.state
            : undefined,
        })),
      ),
    };
  },
});
export const patientInvoices = query({
  args: { profileId: v.id("profiles") },
  returns: v.array(invoiceValue),
  handler: async (ctx, { profileId }) => {
    await carePatient(ctx, profileId);
    return ctx.db
      .query("careInvoices")
      .withIndex("by_profile", (q) => q.eq("profileId", profileId))
      .order("desc")
      .take(30);
  },
});
export const issue = mutation({
  args: {
    profileId: v.id("profiles"),
    description: v.string(),
    amountRwf: v.number(),
    dueAt: v.number(),
  },
  returns: v.id("careInvoices"),
  handler: async (ctx, args) => {
    const r = await carePatient(ctx, args.profileId),
      description = clean(args.description, 200);
    if (
      !description ||
      !Number.isSafeInteger(args.amountRwf) ||
      args.amountRwf < 1 ||
      args.amountRwf > 100_000_000 ||
      !Number.isFinite(args.dueAt) ||
      args.dueAt < Date.now() - 86400000 ||
      args.dueAt > Date.now() + 366 * 86400000
    )
      throw new ConvexError(
        "Enter a description, whole RWF amount (1–100,000,000), and a valid due date.",
      );
    const id = await ctx.db.insert("careInvoices", {
      ...args,
      description,
      createdBy: r.user._id,
      ...(r.clinician ? { clinicianId: r.clinician._id } : {}),
      state: "issued",
      createdAt: Date.now(),
    });
    await audit(ctx, r.user._id, "invoice.issued", id, args.profileId);
    return id;
  },
});
export const voidInvoice = mutation({
  args: { id: v.id("careInvoices") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) throw new ConvexError("Invoice unavailable.");
    const r = await carePatient(ctx, row.profileId);
    if (!r.administrator && row.createdBy !== r.user._id)
      throw new ConvexError(
        "Only the issuer or administrator can void this invoice.",
      );
    const payment = row.activePaymentId
      ? await ctx.db.get(row.activePaymentId)
      : null;
    if (row.state !== "issued" || (payment && payment.state !== "failed"))
      throw new ConvexError(
        "An invoice with a pending or completed payment cannot be voided.",
      );
    await ctx.db.patch(id, { state: "void" });
    await audit(ctx, r.user._id, "invoice.void", id, row.profileId);
    return null;
  },
});
export const begin = internalMutation({
  args: {
    invoiceId: v.id("careInvoices"),
    provider: v.string(),
    phone: v.string(),
    depositId: v.string(),
  },
  returns: v.object({ payment: paymentValue, created: v.boolean() }),
  handler: async (ctx, args) => {
    if (!enabled())
      throw new ConvexError(
        "Mobile-money checkout is awaiting merchant connection.",
      );
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.state !== "issued")
      throw new ConvexError("Invoice is not payable.");
    const { user } = await accessProfile(ctx, invoice.profileId, true);
    if (
      !/^2507\d{8}$/.test(args.phone) ||
      !args.provider ||
      args.provider.length > 80 ||
      !/^[-a-f0-9]{36}$/.test(args.depositId)
    )
      throw new ConvexError(
        "Enter a Rwanda mobile number and a supported provider.",
      );
    if (invoice.activePaymentId) {
      const old = await ctx.db.get(invoice.activePaymentId);
      if (old && old.state !== "failed")
        return { payment: old, created: false };
    }
    const recent = await ctx.db
      .query("mobileMoneyPayments")
      .withIndex("by_payer_created", (q) =>
        q.eq("payerId", user._id).gte("createdAt", Date.now() - 3600000),
      )
      .order("desc")
      .take(5);
    if (
      recent.length >= 5 ||
      (recent[0] && Date.now() - recent[0].createdAt < 10000)
    )
      throw new ConvexError(
        "Please wait before requesting another payment. At most five new requests are allowed per hour.",
      );
    const id = await ctx.db.insert("mobileMoneyPayments", {
      invoiceId: invoice._id,
      profileId: invoice.profileId,
      payerId: user._id,
      depositId: args.depositId,
      amountRwf: invoice.amountRwf,
      provider: args.provider,
      phone: args.phone,
      state: "pending",
      createdAt: Date.now(),
    });
    await ctx.db.patch(invoice._id, { activePaymentId: id });
    // Persist the verifier in the same transaction as the payment UUID. The
    // request remains recoverable if the client action exits before its POST.
    await ctx.scheduler.runAfter(10000, internal.mobileMoney.poll, {
      id,
      attempt: 0,
    });
    await audit(ctx, user._id, "payment.requested", id, invoice.profileId);
    return { payment: (await ctx.db.get(id))!, created: true };
  },
});
export const payment = internalQuery({
  args: { id: v.id("mobileMoneyPayments") },
  returns: v.union(paymentValue, v.null()),
  handler: async (ctx, { id }) => ctx.db.get(id),
});
export const reconcile = internalMutation({
  args: {
    id: v.id("mobileMoneyPayments"),
    state: v.union(
      v.literal("pending"),
      v.literal("uncertain"),
      v.literal("failed"),
      v.literal("completed"),
      v.literal("review"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { id, state }) => {
    const p = await ctx.db.get(id);
    if (
      !p ||
      p.state === "completed" ||
      p.state === "review" ||
      p.state === "failed"
    )
      return null;
    await ctx.db.patch(id, { state, checkedAt: Date.now() });
    if (state === "completed") {
      const invoice = await ctx.db.get(p.invoiceId);
      if (
        !invoice ||
        invoice.state !== "issued" ||
        invoice.activePaymentId !== id ||
        invoice.amountRwf !== p.amountRwf
      ) {
        await ctx.db.patch(id, { state: "review" });
        return null;
      }
      await ctx.db.patch(invoice._id, { state: "paid", paidAt: Date.now() });
      await audit(ctx, p.payerId, "payment.verified", id, invoice.profileId);
    }
    return null;
  },
});
export const authorizeProviders = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await account(ctx);
    return null;
  },
});
export const payableInvoice = internalQuery({
  args: { id: v.id("careInvoices") },
  returns: invoiceValue,
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.state !== "issued")
      throw new ConvexError("Invoice not payable.");
    await accessProfile(ctx, row.profileId, true);
    return row;
  },
});

export const claimRefresh = internalMutation({
  args: { invoiceId: v.id("careInvoices") },
  returns: v.union(v.id("mobileMoneyPayments"), v.null()),
  handler: async (ctx, { invoiceId }) => {
    const invoice = await ctx.db.get(invoiceId);
    if (!invoice?.activePaymentId)
      throw new ConvexError("No payment to refresh.");
    await accessProfile(ctx, invoice.profileId, true);
    const p = await ctx.db.get(invoice.activePaymentId);
    if (
      !p ||
      p.state === "completed" ||
      p.state === "failed" ||
      p.state === "review" ||
      (p.checkedAt && Date.now() - p.checkedAt < 10000)
    )
      return null;
    await ctx.db.patch(p._id, { checkedAt: Date.now() });
    return p._id;
  },
});
