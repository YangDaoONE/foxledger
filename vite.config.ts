import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => ({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              priority: 40,
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
            },
            {
              name: "vendor-tanstack",
              priority: 30,
              test: /node_modules[\\/]@tanstack[\\/]/,
            },
            {
              name: "vendor-supabase",
              priority: 20,
              test: /node_modules[\\/]@supabase[\\/]/,
            },
            {
              name: "vendor-storage",
              priority: 10,
              test: /node_modules[\\/](?:dexie|workbox-window|workbox-core)[\\/]/,
            },
          ],
        },
      },
    },
  },
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(
        new URL("./supabase/functions/_shared", import.meta.url),
      ),
    },
  },
  plugins: [
    react(),
    VitePWA({
      injectRegister: "auto",
      registerType: "autoUpdate",
      includeAssets: ["offline.html", "icon.svg"],
      manifest: {
        name: "FoxLedger 狐狐记账",
        short_name: "FoxLedger",
        description: "移动端优先的个人 AI 记账 PWA",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#FBF7F0",
        theme_color: "#B5571D",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/auth\/v1\//,
          /^\/functions\/v1\//,
          /^\/rest\/v1\//,
          /^\/storage\/v1\//,
        ],
        runtimeCaching: [
          {
            urlPattern: () => true,
            handler: "NetworkOnly",
            method: "POST",
          },
          {
            urlPattern: () => true,
            handler: "NetworkOnly",
            method: "PUT",
          },
          {
            urlPattern: () => true,
            handler: "NetworkOnly",
            method: "PATCH",
          },
          {
            urlPattern: () => true,
            handler: "NetworkOnly",
            method: "DELETE",
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".supabase.co") ||
              /^\/(?:auth|functions|rest|storage)\/v1\//.test(url.pathname),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ request, url }) =>
              request.method === "GET" &&
              request.destination === "image" &&
              url.origin === self.location.origin,
            handler: "CacheFirst",
            options: {
              cacheName: "foxledger-local-images",
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
}));
