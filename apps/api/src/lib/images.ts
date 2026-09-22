import sharp from "sharp";

const WATERMARK = "VUEKUMI";

/**
 * Re-encodes the uploaded original at full resolution/near-lossless quality with
 * EXIF/GPS/IPTC/XMP metadata stripped (sharp omits metadata unless withMetadata()
 * is called). Subjects and shoot locations across Africa must not be
 * deanonymizable via a purchased download's embedded GPS coordinates.
 */
export async function stripOriginalMetadata(
  original: Buffer,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const img = sharp(original).rotate();
  const meta = await sharp(original).metadata();
  switch (meta.format) {
    case "png":
      return { buffer: await img.png({ compressionLevel: 9 }).toBuffer(), mimeType: "image/png" };
    case "webp":
      return { buffer: await img.webp({ quality: 95 }).toBuffer(), mimeType: "image/webp" };
    case "tiff":
      return { buffer: await img.tiff({ quality: 95 }).toBuffer(), mimeType: "image/tiff" };
    default:
      return {
        buffer: await img.jpeg({ quality: 95, mozjpeg: true }).toBuffer(),
        mimeType: "image/jpeg",
      };
  }
}

export async function processDerivatives(original: Buffer, premium: boolean) {
  const meta = await sharp(original).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const preview = await sharp(original)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const thumb = await sharp(original)
    .rotate()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();

  let watermarked: Buffer | null = null;
  if (premium) {
    const previewMeta = await sharp(preview).metadata();
    const w = previewMeta.width ?? 1200;
    const h = previewMeta.height ?? 800;
    const fontSize = Math.max(28, Math.round(Math.min(w, h) / 14));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <style>
        .wm { fill: rgba(255,255,255,0.28); font-family: Arial, sans-serif; font-weight: 800; font-size: ${fontSize}px; letter-spacing: 0.18em; }
      </style>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="wm" transform="rotate(-24 ${w / 2} ${h / 2})">${WATERMARK}</text>
    </svg>`;
    watermarked = await sharp(preview)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  }

  return {
    width,
    height,
    preview,
    thumb,
    watermarked,
  };
}
