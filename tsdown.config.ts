import { defineConfig } from "tsdown";

const env = {
  NODE_ENV: "production",
};

// On some Windows setups, antivirus/indexers can hold stale files in dist and break clean().
const cleanDist = process.platform !== "win32";

export default defineConfig([
  {
    entry: "src/index.ts",
    clean: cleanDist,
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/entry.ts",
    clean: cleanDist,
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    // Ensure this module is bundled as an entry so legacy CLI shims can resolve its exports.
    entry: "src/cli/daemon-cli.ts",
    clean: cleanDist,
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/infra/warning-filter.ts",
    clean: cleanDist,
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/plugin-sdk/index.ts",
    clean: cleanDist,
    outDir: "dist/plugin-sdk",
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/plugin-sdk/account-id.ts",
    clean: cleanDist,
    outDir: "dist/plugin-sdk",
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/extensionAPI.ts",
    clean: cleanDist,
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: ["src/hooks/bundled/*/handler.ts", "src/hooks/llm-slug-generator.ts"],
    clean: cleanDist,
    env,
    fixedExtension: false,
    platform: "node",
  },
]);
