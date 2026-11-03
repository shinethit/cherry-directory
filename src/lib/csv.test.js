import { describe, it, expect } from 'vitest'
import { parseCSV } from './csv'

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
