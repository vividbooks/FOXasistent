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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://vividbooks.github.io;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
