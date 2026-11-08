import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import listPublicStartupsTool from "./tools/list-public-startups";

// Must be the direct Supabase host, not the .lovable.cloud proxy — mcp-js
// verifies tokens against the issuer that discovery advertises.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ventura-mcp",
  title: "Ventura",
  version: "0.1.0",
  instructions:
    "Tools for Ventura, a platform for founders and investors. Sign in as a Ventura user to authorize access, then use `echo` to verify connectivity and `list_public_startups` to browse publicly listed startups on Ventura.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [echoTool, listPublicStartupsTool],
});
