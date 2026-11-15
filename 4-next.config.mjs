/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

// Enables Cloudflare bindings (D1) when running `next dev` against the
// OpenNext adapter. No effect on the Netlify build or deploy.
if (process.env.PACKPROOF_STORE === "d1") {
  const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}
