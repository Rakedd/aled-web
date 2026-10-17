const COMBINING_MARK_PATTERN = /\p{M}/gu
const WHITESPACE_SEQUENCE_PATTERN = /\s+/g

export const normalizeEntityName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(COMBINING_MARK_PATTERN, '')
    .toLowerCase()
    .replace(WHITESPACE_SEQUENCE_PATTERN, ' ')
    .trim()

export const formatEndClientLabel = (name: string, parentName: string | null): string =>
  parentName ? `${name} (${parentName})` : name
