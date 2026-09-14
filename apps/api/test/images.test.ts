import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { processDerivatives } from '../src/lib/images.js'

async function sampleJpeg() {
  return sharp({
    create: { width: 900, height: 600, channels: 3, background: { r: 32, g: 96, b: 48 } },
  })
    .jpeg()
    .toBuffer()
}

test('free collection has preview and thumb, no watermark', async () => {
  const derived = await processDerivatives(await sampleJpeg(), false)
  assert.ok(derived.width === 900)
  assert.ok(derived.height === 600)
  assert.ok(derived.preview.length > 0)
  assert.ok(derived.thumb.length > 0)
  assert.equal(derived.watermarked, null)
  const previewMeta = await sharp(derived.preview).metadata()
  assert.ok((previewMeta.width ?? 0) <= 1600)
})

test('premium collection watermarks the preview', async () => {
  const src = await sampleJpeg()
  const derived = await processDerivatives(src, true)
  assert.ok(derived.watermarked)
  assert.ok(!derived.watermarked.equals(derived.preview))
})
