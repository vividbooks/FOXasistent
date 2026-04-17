/** CORS pro /api/extract-document volané z GitHub Pages (nebo Vite dev). */
export function extractDocumentCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  let allow = "*";
  if (
    origin &&
    (origin.endsWith(".github.io") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1"))
  ) {
    allow = origin;
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
