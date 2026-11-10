import { createFileRoute } from "@tanstack/react-router";
import { handleNeemChat } from "@/lib/ai/neem-chat.server";

export const Route = createFileRoute("/api/chat")({
  server: { handlers: { POST: ({ request }) => handleNeemChat(request) } },
});
