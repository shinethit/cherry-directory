import { describe, it, expect } from 'vitest'
import { parseCSV, toCSV } from './csv'

describe('toCSV', () => {
  it('serializes a plain header + rows', () => {
    expect(toCSV(['name', 'category'], [['Shop A', 'Food'], ['Shop B', 'Retail']]))
      .toBe('name,category\nShop A,Food\nShop B,Retail\n')
  })

  it('quotes fields with commas, quotes and newlines', () => {
    expect(toCSV(['name', 'note'], [['Golden, Palace', 'Say "hi"'], ['Shop', 'line one\nline two']]))
      .toBe('name,note\n"Golden, Palace","Say ""hi"""\nShop,"line one\nline two"\n')
  })

  it('turns null/undefined into empty fields and round-trips through parseCSV', () => {
    const text = toCSV(['name', 'phone'], [['Shop A', null], ['Shop B', undefined]])
    expect(text).toBe('name,phone\nShop A,\nShop B,\n')
    const { headers, rows } = parseCSV(text)
    expect(headers).toEqual(['name', 'phone'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ name: 'Shop A', phone: '' })
  })

  it('returns header-only output for empty rows', () => {
    expect(toCSV(['name', 'phone'], [])).toBe('name,phone\n')
  })
})

describe('v9.17: S38 quoted fields keep their spaces, unquoted are trimmed', () => {
  it('keeps spaces inside quoted fields, trims unquoted ones', () => {
    const { rows } = parseCSV('name,note\n"  spaced  ",  padded  \n')
    expect(rows[0].name).toBe('  spaced  ')
    expect(rows[0].note).toBe('padded')
  })

  it('strips quotes from headers via the state machine (N32)', () => {
    const { headers } = parseCSV('"name","phone"\nShop A,09123\n')
    expect(headers).toEqual(['name', 'phone'])
  })
})

describe('parseCSV', () => {
  it('parses a plain header + rows', () => {
    const { headers, rows } = parseCSV('name,category,phone_1\nShop A,Food,09123\nShop B,Retail,09456\n')
    expect(headers).toEqual(['name', 'category', 'phone_1'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ name: 'Shop A', category: 'Food', phone_1: '09123' })
  })

  it('keeps commas inside quoted fields', () => {
    const { rows } = parseCSV('name,category\n"Golden, Palace",Food\n')
    expect(rows[0].name).toBe('Golden, Palace')
  })

  it('keeps newlines inside quoted fields on the same row', () => {
    const { rows } = parseCSV('name,description_mm\nShop,"line one\nline two"\nNext,plain\n')
    expect(rows).toHaveLength(2)
    expect(rows[0].description_mm).toBe('line one\nline two')
    expect(rows[1].name).toBe('Next')
  })

  it('unescapes doubled quotes', () => {
    const { rows } = parseCSV('name,category\n"Say ""hi"" shop",Food\n')
    expect(rows[0].name).toBe('Say "hi" shop')
  })

  it('handles CRLF endings and returns empty for header-only input', () => {
    const { rows } = parseCSV('name,category\r\nShop A,Food\r\n')
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Shop A')
    expect(parseCSV('name,category\n')).toEqual({ headers: [], rows: [] })
  })
})
