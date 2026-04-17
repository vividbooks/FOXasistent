declare module "heic-convert" {
  type ConvertOpts = {
    buffer: Buffer | ArrayBuffer;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  function convert(opts: ConvertOpts): Promise<Buffer | Uint8Array | ArrayBuffer>;
  export default convert;
}
