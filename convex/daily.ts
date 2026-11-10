import { ConvexError, v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export function roomName(id: Id<"consultations">) {
  return `neem-${id}`;
}
export function validRoomUrl(value: unknown, name: string): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      /^[a-z0-9-]+\.daily\.co$/.test(url.hostname) &&
      url.pathname.replace(/\/$/, "") === `/${name}` &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
async function daily(path: string, method = "GET", payload?: unknown) {
  const key = process.env.DAILY_API_KEY?.trim();
  if (!key) throw new ConvexError("Video consultations are being connected.");
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`https://api.daily.co/v1${path}`, {
      method,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: controller.signal,
    });
  } catch {
    throw new ConvexError(
      "The video service could not be reached. Please try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function privateRoomProperties(nbf: number, exp: number) {
  return {
    nbf: nbf,
    exp,
    eject_at_room_exp: true,
    max_participants: 2,
    enable_knocking: false,
    enable_prejoin_ui: true,
    enable_chat: false,
    enable_screenshare: false,
    enable_recording: false,
    enforce_unique_user_ids: true,
    start_audio_off: true,
    start_video_off: true,
    permissions: { canAdmin: false, canSend: ["audio", "video"] },
  };
}
export const join = action({
  args: { id: v.id("consultations"), consent: v.boolean() },
  returns: v.object({
    url: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (
    ctx,
    { id, consent },
  ): Promise<{ url: string; token: string; expiresAt: number }> => {
    if (!consent)
      throw new ConvexError("Review the video privacy notice before joining.");
    const access = await ctx.runQuery(internal.consultations.authorizeJoin, {
      id,
      now: Date.now(),
    });
    await ctx.runMutation(internal.consultations.reserveVideo, { id });
    const name = roomName(id),
      expiry = Math.floor((access.visit.endsAt + 10 * 60_000) / 1000);
    let response = await daily(`/rooms/${name}`);
    if (response.status === 404) {
      response = await daily("/rooms", "POST", {
        name,
        privacy: "private",
        properties: privateRoomProperties(
          Math.floor((access.visit.startsAt - 5 * 60_000) / 1000),
          expiry,
        ),
      });
      // The other participant may have created the same room concurrently.
      if (response.status === 400 || response.status === 409)
        response = await daily(`/rooms/${name}`);
    }
    if (!response.ok)
      throw new ConvexError(
        "Your private video room could not be prepared. Please try again.",
      );
    const room = await response.json();
    if (!validRoomUrl(room.url, name) || room.privacy !== "private")
      throw new ConvexError("The video room could not be verified.");
    const tokenResponse = await daily("/meeting-tokens", "POST", {
      properties: {
        room_name: name,
        nbf: Math.floor((access.visit.startsAt - 5 * 60_000) / 1000),
        exp: expiry,
        eject_at_token_exp: true,
        is_owner: false,
        user_id: `${id}-${access.role}`,
        user_name: access.role === "clinician" ? "Clinician" : "Patient",
        start_audio_off: true,
        start_video_off: true,
        enable_screenshare: false,
        enable_recording_ui: false,
        start_cloud_recording: false,
        auto_start_transcription: false,
        permissions: { canAdmin: false, canSend: ["audio", "video"] },
      },
    });
    if (!tokenResponse.ok)
      throw new ConvexError(
        "Your video access could not be prepared. Please try again.",
      );
    const result = await tokenResponse.json();
    if (typeof result.token !== "string" || !result.token)
      throw new ConvexError("Your video access could not be verified.");
    // Recheck after the network requests: a cancellation may have happened meanwhile.
    await ctx.runQuery(internal.consultations.authorizeJoin, {
      id,
      now: Date.now(),
    });
    return { url: room.url, token: result.token, expiresAt: expiry * 1000 };
  },
});
export const removeRoom = internalAction({
  args: { id: v.id("consultations"), attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { id, attempt = 0 }) => {
    if (!process.env.DAILY_API_KEY) return null;
    try {
      // Eject connected participants before removing the private room.
      const eject = await daily(`/rooms/${roomName(id)}/eject`, "POST", {
        user_ids: [`${id}-patient`, `${id}-clinician`],
        ban: true,
      });
      // A room with no active session may reject ejection. Still delete it so
      // previously issued tokens cannot open a new call after cancellation.
      const response = await daily(`/rooms/${roomName(id)}`, "DELETE");
      if (!response.ok && response.status !== 404) throw new Error("retry");
      if (!eject.ok && eject.status !== 404) throw new Error("retry");
    } catch {
      if (attempt < 3)
        await ctx.scheduler.runAfter(
          5000 * (attempt + 1),
          internal.daily.removeRoom,
          { id, attempt: attempt + 1 },
        );
      else
        throw new ConvexError("Video room cleanup needs operator attention.");
    }
    return null;
  },
});

// Operator smoke check: no health records, user identity or media are involved.
export const checkConnection = internalAction({
  args: {},
  returns: v.object({
    roomCreated: v.boolean(),
    tokenCreated: v.boolean(),
    roomDeleted: v.boolean(),
  }),
  handler: async () => {
    const name = `neem-check-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const nbf = Math.floor(Date.now() / 1000) - 5,
      exp = nbf + 125;
    const created = await daily("/rooms", "POST", {
      name,
      privacy: "private",
      properties: privateRoomProperties(nbf, exp),
    });
    if (!created.ok) {
      const detail = (await created.text())
        .replaceAll(process.env.DAILY_API_KEY || "[no-key]", "[hidden]")
        .slice(0, 500);
      throw new ConvexError(
        `Daily room check failed (HTTP ${created.status}): ${detail}`,
      );
    }
    try {
      const room = await created.json();
      if (!validRoomUrl(room.url, name) || room.privacy !== "private")
        throw new ConvexError("Daily returned an unexpected room.");
      const response = await daily("/meeting-tokens", "POST", {
        properties: {
          room_name: name,
          nbf,
          exp,
          eject_at_token_exp: true,
          is_owner: false,
          user_id: "connection-check",
          user_name: "Connection check",
          start_video_off: true,
          start_audio_off: true,
          enable_recording_ui: false,
          enable_screenshare: false,
          permissions: { canAdmin: false, canSend: ["audio", "video"] },
        },
      });
      if (!response.ok)
        throw new ConvexError(
          `Daily token check failed (HTTP ${response.status}).`,
        );
      const token = await response.json();
      if (typeof token.token !== "string")
        throw new ConvexError("Daily did not return a valid token.");
    } finally {
      const removed = await daily(`/rooms/${name}`, "DELETE");
      if (!removed.ok && removed.status !== 404)
        throw new ConvexError(
          "The test room expired, but cleanup needs attention.",
        );
    }
    return { roomCreated: true, tokenCreated: true, roomDeleted: true };
  },
});
