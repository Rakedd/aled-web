import type { NextConfig } from "next";

const JOB_SPEC_UPLOAD_BODY_SIZE_LIMIT = "11mb";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: JOB_SPEC_UPLOAD_BODY_SIZE_LIMIT },
    proxyClientMaxBodySize: JOB_SPEC_UPLOAD_BODY_SIZE_LIMIT,
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
