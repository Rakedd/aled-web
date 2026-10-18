/** @jest-environment node */
import type { PostgrestError } from '@supabase/supabase-js'
import { fetchEveryRow } from './fetch-every-row'

jest.mock('server-only', () => ({}))

type RequestedRange = [number, number]

const buildRows = (rowCount: number): number[] => Array.from({ length: rowCount }, (_, rowIndex) => rowIndex)

const createPagedTable = (rows: number[]) => {
  const requestedRanges: RequestedRange[] = []
  const fetchRowPage = async (firstRowIndex: number, lastRowIndex: number) => {
    requestedRanges.push([firstRowIndex, lastRowIndex])
    return { data: rows.slice(firstRowIndex, lastRowIndex + 1), error: null }
  }
  return { requestedRanges, fetchRowPage }
}

describe('fetchEveryRow', () => {
  it('stops after a page shorter than the page size without an extra empty request', async () => {
    const { requestedRanges, fetchRowPage } = createPagedTable(buildRows(2500))

    const fetchedRows = await fetchEveryRow('listRows', fetchRowPage)

    expect(fetchedRows).toEqual(buildRows(2500))
    expect(requestedRanges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('asks for one more page only when the last page is full', async () => {
    const { requestedRanges, fetchRowPage } = createPagedTable(buildRows(1000))

    const fetchedRows = await fetchEveryRow('listRows', fetchRowPage)

    expect(fetchedRows).toHaveLength(1000)
    expect(requestedRanges).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('makes a single request for an empty table', async () => {
    const { requestedRanges, fetchRowPage } = createPagedTable([])

    await expect(fetchEveryRow('listRows', fetchRowPage)).resolves.toEqual([])
    expect(requestedRanges).toEqual([[0, 999]])
  })

  it('treats a null page as the end of the rows', async () => {
    const fetchRowPage = jest.fn().mockResolvedValue({ data: null, error: null })

    await expect(fetchEveryRow('listRows', fetchRowPage)).resolves.toEqual([])
    expect(fetchRowPage).toHaveBeenCalledTimes(1)
  })

  it('throws a repository error naming the operation when a page fails', async () => {
    const postgrestError = { code: '57014', message: 'canceling statement', details: '', hint: '' } as PostgrestError
    const fetchRowPage = jest.fn().mockResolvedValue({ data: null, error: postgrestError })

    await expect(fetchEveryRow('listRows', fetchRowPage)).rejects.toThrow(
      'Repository operation listRows failed with code 57014',
    )
  })
})
