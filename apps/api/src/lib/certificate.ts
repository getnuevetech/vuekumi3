function escapePdf(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export interface CertificateFields {
  code: string
  issuedAt: string
  photoTitle: string
  photoId: string
  photographer: string
  licensee: string
  licenseeEmail: string
  licenseName: string
  amountLabel: string
  scopeLines: string[]
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > width) {
      if (current) lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

export function buildCertificatePdf(fields: CertificateFields): Buffer {
  const body = [
    'VUEKUMI LICENSE CERTIFICATE',
    '',
    `Certificate  ${fields.code}`,
    `Issued       ${fields.issuedAt}`,
    '',
    `Photograph   ${fields.photoTitle}`,
    `Asset ID     ${fields.photoId}`,
    `Copyright    ${fields.photographer}`,
    '',
    `Licensee     ${fields.licensee}`,
    `Email        ${fields.licenseeEmail}`,
    `Licence      ${fields.licenseName}`,
    `Amount       ${fields.amountLabel}`,
    '',
    'Scope',
    ...fields.scopeLines.flatMap((line) => wrap(line, 78)),
    '',
    'This certificate records a grant of usage permission, not a transfer of ownership.',
    'Copyright remains with the photographer. Vuekumi sublicenses under the VueKumi',
    'platform agreement. Model rights, where required, were verified before this grant.',
    '',
    'Four rights layers: (1) photographer copyright  (2) model rights',
    '(3) VueKumi platform licence  (4) this buyer grant.',
  ]

  const ops: string[] = []
  let y = 760
  for (const [i, line] of body.entries()) {
    const size = i === 0 ? 16 : 11
    if (i === 0) {
      ops.push(`BT /F1 ${size} Tf 50 ${y} Td (${escapePdf(line)}) Tj ET`)
    } else {
      ops.push(`BT /F1 ${size} Tf 50 ${y} Td (${escapePdf(line)}) Tj ET`)
    }
    y -= i === 0 ? 28 : 16
  }

  const stream = ops.join('\n')
  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${obj}\n`
  }
  const xrefStart = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return Buffer.from(pdf)
}
