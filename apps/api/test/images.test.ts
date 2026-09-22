import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { processDerivatives, stripOriginalMetadata } from '../src/lib/images.js'

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

test('stripOriginalMetadata removes EXIF/GPS before an original is ever storable', async () => {
  const withGps = await sharp({
    create: { width: 240, height: 160, channels: 3, background: { r: 12, g: 34, b: 56 } },
  })
    .jpeg()
    .withMetadata({
      exif: {
        IFD0: { Copyright: 'Vuekumi Test Photographer' },
        GPS: { GPSLatitude: '6/1,31/1,0/1', GPSLongitude: '3/1,23/1,0/1' },
      },
    })
    .toBuffer()

  const before = await sharp(withGps).metadata()
  assert.ok(before.exif, 'fixture must carry EXIF/GPS before stripping, or this test proves nothing')

  const cleaned = await stripOriginalMetadata(withGps)
  assert.equal(cleaned.mimeType, 'image/jpeg')

  const after = await sharp(cleaned.buffer).metadata()
  assert.equal(after.exif, undefined)
  assert.equal(after.width, 240)
  assert.equal(after.height, 160)
})
