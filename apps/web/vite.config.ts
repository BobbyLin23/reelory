import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import { defineConfig } from "vite-plus";

export default defineConfig({
  optimizeDeps: {
    entries: ["src/**/*.{ts,tsx}"],
  },
  plugins: [
    varlockVitePlugin({ ssrInjectMode: "auto-load" }),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
