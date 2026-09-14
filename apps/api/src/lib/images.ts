import sharp from "sharp";

const WATERMARK = "VUEKUMI";

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
