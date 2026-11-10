import type { AuthConfig } from "convex/server";

// An unconfigured deployment accepts no identity providers.
const domain = process.env.CLERK_JWT_ISSUER_DOMAIN;
export default {
  providers: domain ? [{ domain, applicationID: "convex" }] : [],
} satisfies AuthConfig;
