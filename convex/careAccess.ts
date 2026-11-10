import { ConvexError } from "convex/values";
import { account } from "./access";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
type Ctx = QueryCtx | MutationCtx;
export async function careRole(ctx: Ctx) {
  const user = await account(ctx);
  const administrator = (process.env.NEEM_CARE_ADMIN_CLERK_IDS || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .includes(user.clerkId);
  const row = await ctx.db
    .query("clinicians")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", user.clerkId))
    .unique();
  return { user, administrator, clinician: row?.active ? row : null };
}
export async function careAdmin(ctx: Ctx) {
  const role = await careRole(ctx);
  if (!role.administrator)
    throw new ConvexError("Administrator access required.");
  return role;
}
export async function careStaff(ctx: Ctx) {
  const role = await careRole(ctx);
  if (!role.administrator && !role.clinician)
    throw new ConvexError("Care team access required.");
  return role;
}
export async function carePatient(
  ctx: Ctx,
  profileId: Id<"profiles">,
  clinicalWrite = false,
) {
  const role = await careStaff(ctx);
  const assignment = role.clinician
    ? await ctx.db
        .query("careAssignments")
        .withIndex("by_profile_clinician", (q) =>
          q.eq("profileId", profileId).eq("clinicianId", role.clinician!._id),
        )
        .unique()
    : null;
  if (
    clinicalWrite
      ? !role.clinician || !assignment?.active
      : !role.administrator && !assignment?.active
  )
    throw new ConvexError("This patient is not assigned to you.");
  const profile = await ctx.db.get(profileId);
  if (!profile) throw new ConvexError("Patient unavailable.");
  return { ...role, profile };
}
export async function audit(
  ctx: MutationCtx,
  actor: Id<"users">,
  action: string,
  entityId: string,
  profileId?: Id<"profiles">,
) {
  await ctx.db.insert("careAudit", {
    actor,
    action,
    entityId,
    ...(profileId ? { profileId } : {}),
    at: Date.now(),
  });
}
export function clean(value: string, max = 4000) {
  const s = value.trim();
  if (s.length > max)
    throw new ConvexError(`Keep this field under ${max} characters.`);
  return s;
}
