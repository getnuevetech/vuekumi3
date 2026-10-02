import QRCode from 'qrcode'

/** Brand mark geometry mirrored from `LogoMark` in `components/shared.tsx`. */
function drawVuekumiMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  accent = '#ef5b24',
) {
  const r = size / 2
  const stroke = Math.max(1.4, size * 0.055)

  // White pad so the mark stays legible on the module grid.
  const pad = r * 1.15
  ctx.fillStyle = '#ffffff'
  const x = cx - pad
  const y = cy - pad
  const side = pad * 2
  const radius = pad * 0.28
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, side, side, radius)
  } else {
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + side, y, x + side, y + side, radius)
    ctx.arcTo(x + side, y + side, x, y + side, radius)
    ctx.arcTo(x, y + side, x, y, radius)
    ctx.arcTo(x, y, x + side, y, radius)
    ctx.closePath()
  }
  ctx.fill()

  ctx.strokeStyle = '#14110e'
  ctx.lineWidth = stroke
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = accent
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#14110e'
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx, cy - r * 0.7)
  ctx.moveTo(cx, cy + r * 0.7)
  ctx.lineTo(cx, cy + r)
  ctx.moveTo(cx - r, cy)
  ctx.lineTo(cx - r * 0.7, cy)
  ctx.moveTo(cx + r * 0.7, cy)
  ctx.lineTo(cx + r, cy)
  ctx.stroke()
}

/**
 * Build a QR data URL with the VueKumi logo mark centered.
 * Uses high error correction so the logo overlay remains scannable.
 */
export async function vuekumiQrDataUrl(
  text: string,
  size: number,
  accent = '#ef5b24',
): Promise<string> {
  const canvas = document.createElement('canvas')
  await QRCode.toCanvas(canvas, text, {
    margin: 1,
    width: size,
    errorCorrectionLevel: 'H',
    color: { dark: '#14110e', light: '#ffffff' },
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/png')

  const markSize = Math.max(18, Math.round(size * 0.22))
  drawVuekumiMark(ctx, size / 2, size / 2, markSize, accent)
  return canvas.toDataURL('image/png')
}
