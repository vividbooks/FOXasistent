import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// GitHub Pages: vividbooks.github.io/FOXasistent/
export default defineConfig({
  resolve: {
    alias: {
      "@foxasistent/lib": path.resolve(__dirname, "../lib"),
    },
  },
  server: {
    fs: { allow: [".."] },
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/tesseract.js/dist/worker.min.js",
          dest: "tesseract",
        },
        {
          src: "node_modules/tesseract.js-core/*",
          dest: "tesseract/core",
        },
        {
          src: "public/tesseract-lang/*.gz",
          dest: "tesseract-lang",
        },
      ],
    }),
  ],
  base: "/FOXasistent/",
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
