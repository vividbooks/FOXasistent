import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "sharp",
    "tesseract.js",
    "tesseract.js-core",
    "heic-convert",
    "heic-decode",
    "libheif-js",
  ],
};

export default nextConfig;
