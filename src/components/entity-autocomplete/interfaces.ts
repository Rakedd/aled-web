import type { ActionResult } from '@/domain/action-result'
import type { EntityKind, EntitySuggestion } from '@/domain/entities'

export type SearchEntities = (entityKind: EntityKind, query: string) => Promise<ActionResult<EntitySuggestion[]>>

export type EntityAutocompleteControllerParameters = {
  entityKind: EntityKind
  onChange: (value: string) => void
  onSelectSuggestion?: (suggestion: EntitySuggestion) => void
  searchEntities: SearchEntities
  allowsCreation?: boolean
}

export type EntityAutocompleteProps = EntityAutocompleteControllerParameters & {
  value: string
  id?: string
}
