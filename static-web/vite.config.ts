import { defineConfig } from "vite";

// GitHub Pages project site: vividbooks.github.io/FOXasistent/
export default defineConfig({
  base: "/FOXasistent/",
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
