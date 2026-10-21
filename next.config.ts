import type { NextConfig } from "next";
import { parseLandingHostnames } from "./src/domain/landing-routing";

type NextRedirect = Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>[number];

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

export const buildLandingApiRedirects = (environment: {
  landingHostnames: string | undefined;
  appOrigin: string | undefined;
}): NextRedirect[] => {
  if (!environment.appOrigin) return [];
  return parseLandingHostnames(environment.landingHostnames).map((landingHostname) => ({
    source: "/api/:path*",
    has: [{ type: "host", value: landingHostname }],
    destination: `${environment.appOrigin}/api/:path*`,
    permanent: true,
  }));
};

const nextConfig: NextConfig = {
  redirects: async () => [
    { source: "/settings", destination: "/preferences", permanent: true },
    { source: "/settings/:path*", destination: "/preferences/:path*", permanent: true },
    ...buildLandingApiRedirects({
      landingHostnames: process.env.LANDING_HOSTNAMES,
      appOrigin: process.env.APP_ORIGIN,
    }),
  ],
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
