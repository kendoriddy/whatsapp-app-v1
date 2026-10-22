import { defineConfig } from "vitest/config";
import path from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@mmabon/shared": path.resolve(root, "packages/shared/src/index.ts"),
      "@mmabon/db": path.resolve(root, "packages/db/src/index.ts"),
      "@mmabon/queue": path.resolve(root, "packages/queue/src/index.ts"),
      "@mmabon/whatsapp": path.resolve(root, "packages/whatsapp/src/index.ts"),
      "@mmabon/paystack": path.resolve(root, "packages/paystack/src/index.ts"),
      "@mmabon/ai": path.resolve(root, "packages/ai/src/index.ts"),
      "@mmabon/domain": path.resolve(root, "packages/domain/src/index.ts"),
    },
  },
});
