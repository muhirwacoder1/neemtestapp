import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import {
  openRouterProvider,
  AIAllowanceError,
  AIServiceError,
} from "./gateway";
import { chatConfigured, chatModel } from "./modelPolicy";

// Owner/CLI diagnostic only. Uses synthetic text, never patient records, and
// passes through the same free-only transport and atomic quota as live chat.
export const checkConnection = internalAction({
  args: {},
  returns: v.object({
    configured: v.boolean(),
    ok: v.boolean(),
    toolsWorking: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    if (!chatConfigured())
      return {
        configured: false,
        ok: false,
        toolsWorking: false,
        message:
          "Add OPENROUTER_API_KEY to this Convex deployment and select a free model.",
      };
    let toolsWorking = false;
    try {
      const result = await generateText({
        model: openRouterProvider(ctx).chat(chatModel()),
        prompt:
          "This is a Neem connection test with no personal data. Call check_connection with status ok, then reply Neem connection OK.",
        tools: {
          check_connection: tool({
            description: "Test that Neem can execute a model's function call.",
            inputSchema: z.object({ status: z.literal("ok") }),
            execute: async () => {
              toolsWorking = true;
              return { status: "ok" as const };
            },
          }),
        },
        stopWhen: stepCountIs(2),
        maxOutputTokens: 1600,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(60000),
      });
      const ok = toolsWorking && !!result.text.trim();
      return {
        configured: true,
        ok,
        toolsWorking,
        message: ok
          ? "OpenRouter returned a reply and executed the test tool."
          : "OpenRouter responded, but the full tool-and-reply test did not complete.",
      };
    } catch (error) {
      return {
        configured: true,
        ok: false,
        toolsWorking,
        message:
          error instanceof AIAllowanceError || error instanceof AIServiceError
            ? error.message
            : "The live AI connection test could not complete. Check OpenRouter activity and provider availability.",
      };
    }
  },
});
