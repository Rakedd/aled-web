import { useState } from 'react'
import {
  filterIntermediaries,
  INITIAL_INTERMEDIARIES_SORT,
  type IntermediariesSortKey,
  type ListSort,
  sortIntermediaries,
  toggleListSort,
} from '@/domain/contact-search'
import type { IntermediariesTableProps } from './interfaces'

export const useController = ({ intermediaries }: IntermediariesTableProps) => {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ListSort<IntermediariesSortKey>>(INITIAL_INTERMEDIARIES_SORT)

  const visibleIntermediaries = sortIntermediaries(filterIntermediaries(intermediaries, query), sort)

  const toggleSort = (clickedKey: IntermediariesSortKey) =>
    setSort((currentSort) => toggleListSort(currentSort, clickedKey))

  return { query, setQuery, sort, toggleSort, visibleIntermediaries }
}
