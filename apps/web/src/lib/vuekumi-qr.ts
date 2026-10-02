import QRCode from 'qrcode'

/** Wordmark mirrored from `LogoMark`: VUE in ink, KUMI in brand accent. */
function drawVuekumiWordmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  qrSize: number,
  accent = '#ef5b24',
) {
  const fontSize = Math.max(8, Math.round(qrSize * 0.095))
  ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.letterSpacing = `${Math.max(0.5, fontSize * 0.06)}px`

  const vue = 'VUE'
  const kumi = 'KUMI'
  const vueWidth = ctx.measureText(vue).width
  const kumiWidth = ctx.measureText(kumi).width
  const gap = Math.max(1, fontSize * 0.04)
  const textWidth = vueWidth + gap + kumiWidth
  const padX = Math.max(6, fontSize * 0.55)
  const padY = Math.max(4, fontSize * 0.45)
  const boxW = textWidth + padX * 2
  const boxH = fontSize + padY * 2
  const radius = Math.max(3, fontSize * 0.28)
  const x = cx - boxW / 2
  const y = cy - boxH / 2

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, boxW, boxH, radius)
  } else {
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + boxW, y, x + boxW, y + boxH, radius)
    ctx.arcTo(x + boxW, y + boxH, x, y + boxH, radius)
    ctx.arcTo(x, y + boxH, x, y, radius)
    ctx.arcTo(x, y, x + boxW, y, radius)
    ctx.closePath()
  }
  ctx.fill()

  let cursor = cx - textWidth / 2
  ctx.fillStyle = '#14110e'
  ctx.fillText(vue, cursor, cy)
  cursor += vueWidth + gap
  ctx.fillStyle = accent
  ctx.fillText(kumi, cursor, cy)
}

/**
 * Build a QR data URL with the VUEKUMI text logo centered.
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

  drawVuekumiWordmark(ctx, size / 2, size / 2, size, accent)
  return canvas.toDataURL('image/png')
}
