"use node";
import { v, ConvexError } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { z } from "zod";
const providerValue = v.object({
  id: v.string(),
  name: v.string(),
  min: v.number(),
  max: v.number(),
  instructions: v.string(),
  phonePromptName: v.string(),
});
const conf = z.object({
  signatureConfiguration: z
    .object({ signedRequestsOnly: z.boolean().optional() })
    .optional(),
  countries: z.array(
    z.object({
      country: z.string(),
      providers: z.array(
        z.object({
          provider: z.string(),
          displayName: z.string(),
          nameDisplayedToCustomer: z.string().optional(),
          currencies: z.array(
            z.object({
              currency: z.string(),
              operationTypes: z.object({
                DEPOSIT: z
                  .object({
                    authType: z.string(),
                    minAmount: z.string(),
                    maxAmount: z.string(),
                    pinPromptInstructions: z
                      .object({
                        channels: z
                          .array(
                            z.object({
                              instructions: z
                                .object({
                                  en: z
                                    .array(z.object({ text: z.string() }))
                                    .optional(),
                                })
                                .optional(),
                            }),
                          )
                          .optional(),
                      })
                      .optional(),
                  })
                  .passthrough()
                  .optional(),
              }),
            }),
          ),
        }),
      ),
    }),
  ),
});
function settings() {
  if (
    process.env.PAWAPAY_ENVIRONMENT !== "production" ||
    process.env.PAWAPAY_CHECKOUT_ENABLED !== "true" ||
    !process.env.PAWAPAY_API_TOKEN
  )
    throw new ConvexError(
      "Mobile-money checkout is awaiting merchant connection.",
    );
  return {
    base: "https://api.pawapay.io",
    token: process.env.PAWAPAY_API_TOKEN,
  };
}
async function request(path: string, body?: unknown) {
  const s = settings();
  const r = await fetch(s.base + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${s.token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("Payment service unavailable");
  return r.json();
}
async function providers() {
  const c = conf.parse(await request("/v2/active-conf"));
  if (c.signatureConfiguration?.signedRequestsOnly)
    throw new ConvexError(
      "The merchant requires signed requests. Checkout must be configured before use.",
    );
  return c.countries
    .filter((c) => c.country === "RWA")
    .flatMap((c) =>
      c.providers.flatMap((p) =>
        p.currencies
          .filter((c) => c.currency === "RWF")
          .flatMap((c) => {
            const d = c.operationTypes.DEPOSIT;
            return d?.authType === "PROVIDER_AUTH" &&
              Number.isFinite(Number(d.minAmount)) &&
              Number.isFinite(Number(d.maxAmount))
              ? [
                  {
                    id: p.provider,
                    name: p.displayName,
                    phonePromptName: p.nameDisplayedToCustomer || "pawaPay",
                    min: Number(d.minAmount),
                    max: Number(d.maxAmount),
                    instructions:
                      (d.pinPromptInstructions?.channels?.[0]?.instructions?.en
                        ?.map((step) => step.text)
                        .join(". ") || "Approve the request on your phone.") +
                      " Follow these steps on your phone only. Never enter your mobile-money PIN in Neem.",
                  },
                ]
              : [];
          }),
      ),
    );
}
export const available = action({
  args: {},
  returns: v.array(providerValue),
  handler: async (ctx) => {
    await ctx.runQuery(internal.billing.authorizeProviders, {});
    try {
      return await providers();
    } catch (e) {
      if (e instanceof ConvexError) throw e;
      throw new ConvexError(
        "Could not load mobile-money providers. Please try again.",
      );
    }
  },
});
export const checkout = action({
  args: {
    invoiceId: v.id("careInvoices"),
    provider: v.string(),
    phone: v.string(),
    consent: v.boolean(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (!args.consent)
      throw new ConvexError(
        "Confirm the amount and phone number before paying.",
      );
    const invoice = await ctx.runQuery(internal.billing.payableInvoice, {
      id: args.invoiceId,
    });
    const choices = await providers(),
      selected = choices.find((p) => p.id === args.provider);
    if (!selected)
      throw new ConvexError("Choose a supported Rwanda mobile-money provider.");
    if (invoice.amountRwf < selected.min || invoice.amountRwf > selected.max)
      throw new ConvexError(
        "The invoice is outside this provider’s payment limits.",
      );
    const phone = args.phone.replace(/[+\s-]/g, "").replace(/^0(?=7)/, "250");
    const start = await ctx.runMutation(internal.billing.begin, {
      invoiceId: args.invoiceId,
      provider: args.provider,
      phone,
      depositId: crypto.randomUUID(),
    });
    if (start.created) {
      const p = start.payment;
      try {
        const result = z
          .object({ depositId: z.string(), status: z.string() })
          .parse(
            await request("/v2/deposits", {
              depositId: p.depositId,
              amount: String(p.amountRwf),
              currency: "RWF",
              payer: {
                type: "MMO",
                accountDetails: { phoneNumber: p.phone, provider: p.provider },
              },
              customerMessage: "Neem payment",
              clientReferenceId: p.invoiceId,
            }),
          );
        if (result.depositId !== p.depositId)
          await ctx.runMutation(internal.billing.reconcile, {
            id: p._id,
            state: "review",
          });
        else if (result.status === "REJECTED")
          await ctx.runMutation(internal.billing.reconcile, {
            id: p._id,
            state: "failed",
          });
      } catch {
        await ctx.runMutation(internal.billing.reconcile, {
          id: p._id,
          state: "uncertain",
        });
      }
    }
    return "Payment request recorded. Approve it on your phone, then refresh its status.";
  },
});
const status = z.object({
  status: z.string(),
  data: z
    .object({
      depositId: z.string(),
      status: z.string(),
      amount: z.string(),
      currency: z.string(),
      payer: z.object({
        accountDetails: z.object({
          phoneNumber: z.string(),
          provider: z.string(),
        }),
      }),
    })
    .optional(),
});
export const poll = internalAction({
  args: { id: v.id("mobileMoneyPayments"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const p = await ctx.runQuery(internal.billing.payment, { id: args.id });
    if (!p || ["completed", "failed", "review"].includes(p.state)) return null;
    try {
      const result = status.parse(await request(`/v2/deposits/${p.depositId}`));
      if (result.status === "NOT_FOUND" && Date.now() - p.createdAt > 30000) {
        // Reuse the persisted UUID and exact payload after an uncertain submission.
        // A duplicate request cannot create a second provider deposit.
        await request("/v2/deposits", {
          depositId: p.depositId,
          amount: String(p.amountRwf),
          currency: "RWF",
          payer: {
            type: "MMO",
            accountDetails: { phoneNumber: p.phone, provider: p.provider },
          },
          customerMessage: "Neem payment",
          clientReferenceId: p.invoiceId,
        });
      }
      if (result.status === "FOUND" && result.data) {
        const d = result.data,
          match =
            d.depositId === p.depositId &&
            Number(d.amount) === p.amountRwf &&
            d.currency === "RWF" &&
            d.payer.accountDetails.provider === p.provider &&
            d.payer.accountDetails.phoneNumber === p.phone;
        await ctx.runMutation(internal.billing.reconcile, {
          id: p._id,
          state: !match
            ? "review"
            : d.status === "COMPLETED"
              ? "completed"
              : d.status === "FAILED"
                ? "failed"
                : "pending",
        });
      }
    } catch {
      await ctx.runMutation(internal.billing.reconcile, {
        id: p._id,
        state: "uncertain",
      });
    }
    // Keep checking unresolved deposits after the initial backoff. A delayed
    // provider settlement must not remain unpaid merely because the app closed.
    if (args.attempt >= 0)
      await ctx.scheduler.runAfter(
        args.attempt < 10
          ? Math.min(300000, 15000 * 2 ** args.attempt)
          : 3600000,
        internal.mobileMoney.poll,
        { id: p._id, attempt: Math.min(args.attempt + 1, 12) },
      );
    return null;
  },
});
export const refresh = action({
  args: { invoiceId: v.id("careInvoices") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const id = await ctx.runMutation(internal.billing.claimRefresh, args);
    if (id) await ctx.runAction(internal.mobileMoney.poll, { id, attempt: -1 });
    return null;
  },
});

// Operator-only read check. Does not create a deposit or contact a payer.
export const connectionCheck = internalAction({
  args: {},
  returns: v.array(providerValue),
  handler: async () => providers(),
});
