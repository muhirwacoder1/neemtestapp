import { createFileRoute } from "@tanstack/react-router";
import { mobileGateway } from "@/lib/ai/mobile-gateway.server";

export const Route = createFileRoute("/api/neem-gateway/responses")({
  server: { handlers: { POST: ({ request }) => mobileGateway(request, "responses") } },
});
