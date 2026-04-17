/** Detekce rastrového obrázku podle „magic bytes“ (funguje i když prohlížeč nepošle MIME). */

export function sniffLikelyRasterImage(buf: Buffer): boolean {
  if (!buf || buf.length < 12) return false;

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;

  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;

  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;

  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.length >= 12 &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return true;
  }

  if (buf[0] === 0x42 && buf[1] === 0x4d) return true;

  if (
    (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
    (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)
  ) {
    return true;
  }

  if (buf.toString("ascii", 4, 8) === "ftyp" && buf.length >= 12) {
    const brand = buf.toString("ascii", 8, 12);
    if (/^heic|^heix|^hevc|^hevx|^mif1|^msf1|^heim|^heis|^avic/i.test(brand)) {
      return true;
    }
  }

  return false;
}

export function sniffHeicOrHeif(buf: Buffer): boolean {
  if (!buf || buf.length < 12) return false;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12);
  return /^heic|^heix|^hevc|^hevx|^mif1|^msf1|^heim|^heis/i.test(brand);
}
