import { v, ConvexError } from "convex/values";
import { internalMutation } from "./_generated/server";
import { budgetLimit, reservationCost, EMBEDDING_MODEL } from "./modelPolicy";

export const reserve = internalMutation({
  args: { model: v.string(), inputBytes: v.number(), outputTokens: v.number() },
  returns: v.id("aiCalls"),
  handler: async (ctx, args) => {
    const cost = reservationCost(
      args.model,
      args.inputBytes,
      args.outputTokens,
    );
    const day = new Date().toISOString().slice(0, 10);
    const freeChat = args.model !== EMBEDDING_MODEL;
    const prefix = freeChat ? "openrouter:" : "";
    const caps = [
      ...(freeChat
        ? [
            {
              period: `openrouter:minute:${new Date().toISOString().slice(0, 16)}`,
              limit: Number.MAX_SAFE_INTEGER,
              calls: 20,
            },
          ]
        : []),
      {
        period: `${prefix}day:${day}`,
        limit: budgetLimit(
          process.env.NEEM_AI_DAILY_RESERVE_MICRO_USD,
          500_000,
        ),
        calls: freeChat
          ? Math.min(
              1000,
              budgetLimit(process.env.NEEM_AI_DAILY_CALL_LIMIT, 50),
            )
          : 100,
      },
      {
        period: `${prefix}month:${day.slice(0, 7)}`,
        limit: budgetLimit(
          process.env.NEEM_AI_MONTHLY_RESERVE_MICRO_USD,
          2_000_000,
        ),
        calls: freeChat
          ? budgetLimit(process.env.NEEM_AI_MONTHLY_CALL_LIMIT, 1000)
          : 1000,
      },
    ];
    // Transactional across both periods and all chats, router calls, tool steps
    // and book indexing. No external call occurs unless this commits first.
    for (const cap of caps) {
      const row = await ctx.db
        .query("aiBudgets")
        .withIndex("by_period", (q) => q.eq("period", cap.period))
        .unique();
      if (
        cap.limit <= 0 ||
        (row?.reservedMicroUsd ?? 0) + cost > cap.limit ||
        (row?.calls ?? 0) >= cap.calls
      )
        throw new ConvexError(
          "Neem AI has reached its usage allowance. Please contact the app owner.",
        );
      if (row)
        await ctx.db.patch(row._id, {
          reservedMicroUsd: row.reservedMicroUsd + cost,
          calls: row.calls + 1,
        });
      else
        await ctx.db.insert("aiBudgets", {
          period: cap.period,
          reservedMicroUsd: cost,
          calls: 1,
        });
    }
    return ctx.db.insert("aiCalls", {
      ...args,
      reservedMicroUsd: cost,
      state: "reserved",
    });
  },
});
export const complete = internalMutation({
  args: { id: v.id("aiCalls"), status: v.number() },
  returns: v.null(),
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, {
      state: status >= 200 && status < 300 ? "accepted" : "failed",
      status,
    });
    return null;
  },
});
