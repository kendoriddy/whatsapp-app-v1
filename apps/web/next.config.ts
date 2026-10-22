import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@mmabon/shared",
    "@mmabon/db",
    "@mmabon/queue",
    "@mmabon/whatsapp",
    "@mmabon/paystack",
    "@mmabon/ai",
    "@mmabon/domain",
  ],
  serverExternalPackages: ["postgres", "pg", "pg-boss", "pino"],
  // Turbopack does not map "./x.js" → "x.ts" (NodeNext idiom). Use webpack in
  // local/dev until upstream parity lands: https://github.com/vercel/next.js/issues/82945
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  turbopack: {
    root: rootDir,
  },
};

export default nextConfig;
