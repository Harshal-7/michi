import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@content": fileURLToPath(new URL("./content", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "content/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    // Makes a migrated template database; files that need one copy it (src/db/test/test-db.ts).
    globalSetup: ["./src/db/test/global-setup.ts"],
    // Creating and dropping a database can take a few seconds when the machine is busy.
    hookTimeout: 30_000,
    teardownTimeout: 30_000,
  },
});
