import { describe, it, expect } from 'vitest'
import { csvEscape, csvSerialize, csvParse } from './csv'

describe('csvEscape', () => {
  it('leaves plain values unchanged', () => {
    expect(csvEscape('simple')).toBe('simple')
    expect(csvEscape(123)).toBe('123')
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })

  it('quotes values with commas, quotes or newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('a"b')).toBe('"a""b"')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })
})

describe('csvSerialize', () => {
  it('includes UTF-8 BOM and CRLF line endings', () => {
    const out = csvSerialize(['name', 'desc'], [{ name: 'A', desc: 'x' }])
    expect(out.startsWith('\uFEFF')).toBe(true)
    expect(out).toContain('name,desc\r\n')
    expect(out).toContain('A,x\r\n')
  })

  it('escapes special characters in cells', () => {
    const out = csvSerialize(['name'], [{ name: 'Doe, John' }])
    expect(out).toContain('"Doe, John"')
  })
})

describe('csvParse', () => {
  it('parses rows with headers', () => {
    const rows = csvParse('name,desc\r\nCafé,Arábica\r\nTé,Verde\r\n')
    expect(rows).toEqual([
      { name: 'Café', desc: 'Arábica' },
      { name: 'Té', desc: 'Verde' }
    ])
  })

  it('strips BOM', () => {
    const rows = csvParse('\uFEFFname\r\nA\r\n')
    expect(rows).toEqual([{ name: 'A' }])
  })

  it('handles quoted fields and escaped quotes', () => {
    const rows = csvParse('name,note\r\n"Doe, John","He said ""hi"""\r\n')
    expect(rows).toEqual([{ name: 'Doe, John', note: 'He said "hi"' }])
  })

  it('skips empty lines', () => {
    const rows = csvParse('a,b\r\n\r\n\r\n1,2\r\n')
    expect(rows).toEqual([{ a: '1', b: '2' }])
  })

  it('returns empty array for empty content', () => {
    expect(csvParse('')).toEqual([])
  })
})
