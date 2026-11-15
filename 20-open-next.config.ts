import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Temporary free deployment target (Cloudflare Workers). Kept minimal on
// purpose: the app stays portable and the Netlify deployment is untouched.
export default defineCloudflareConfig();
