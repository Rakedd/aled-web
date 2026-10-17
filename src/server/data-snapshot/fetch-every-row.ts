import 'server-only'
import type { PostgrestError } from '@supabase/supabase-js'
import { toRepositoryError } from '@/server/repositories/repository-error'

type RowPageResult<Row> = { data: Row[] | null; error: PostgrestError | null }

type RowPageFetcher<Row> = (firstRowIndex: number, lastRowIndex: number) => PromiseLike<RowPageResult<Row>>

const ROW_PAGE_SIZE = 1000

export const fetchEveryRow = async <Row>(
  operationName: string,
  fetchRowPage: RowPageFetcher<Row>,
  alreadyFetchedRows: Row[] = [],
): Promise<Row[]> => {
  const firstRowIndex = alreadyFetchedRows.length
  const { data, error } = await fetchRowPage(firstRowIndex, firstRowIndex + ROW_PAGE_SIZE - 1)
  if (error) throw toRepositoryError(operationName, error)
  if (data === null || data.length === 0) return alreadyFetchedRows
  return fetchEveryRow(operationName, fetchRowPage, [...alreadyFetchedRows, ...data])
}
