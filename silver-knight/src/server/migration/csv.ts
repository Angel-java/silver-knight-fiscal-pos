export function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function csvSerialize(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines: string[] = [headers.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','))
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

export function csvParse(text: string): Array<Record<string, string>> {
  const content = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += ch
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (rows.length === 0) return []

  const headers = rows[0].map((h) => h.trim()).filter((h) => h.length > 0)
  const result: Array<Record<string, string>> = []
  for (let r = 1; r < rows.length; r++) {
    const values = rows[r]
    const isEmpty = values.every((v) => v.trim() === '')
    if (isEmpty) continue
    const record: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = (values[c] ?? '').trim()
    }
    result.push(record)
  }
  return result
}
