'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import {
  type ContactDetails,
  type ContactDetailsInput,
  ENTITY_NOT_FOUND_MESSAGES,
  type EntityKind,
  type EntitySuggestion,
  validateContactDetailsInput,
  validateEntitySearchArguments,
  validateIntermediaryKind,
} from '@/domain/entities'
import { validateUuid } from '@/domain/input-validation'
import type { IntermediaryKind } from '@/domain/types'
import {
  assignEndClientParent,
  findContactDetails,
  saveContactDetails,
  saveIntermediaryKind,
  searchEntitySuggestions,
} from '@/server/repositories/entities-repository'
import { runAuthenticatedOperation } from './run-authenticated-operation'

const LOAD_FAILURE_MESSAGE = 'Impossible de charger ces informations pour le moment. Réessaie dans quelques minutes.'
const SAVE_FAILURE_MESSAGE = "Impossible d'enregistrer pour le moment. Réessaie dans quelques minutes."

export const searchEntities = async (
  entityKind: EntityKind,
  query: string,
): Promise<ActionResult<EntitySuggestion[]>> =>
  runAuthenticatedOperation({
    operationName: 'searchEntities',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateEntitySearchArguments(entityKind, query),
    operation: async (supabase, userId, searchArguments) => ({
      ok: true,
      data: await searchEntitySuggestions(supabase, userId, searchArguments),
    }),
  })

export const setEndClientParent = async (
  endClientId: string,
  parentEndClientId: string | null,
): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'setEndClientParent',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ endClientId: string; parentEndClientId: string | null }> => {
      const endClientIdValidation = validateUuid(endClientId, ENTITY_NOT_FOUND_MESSAGES.endClient)
      if (!endClientIdValidation.ok) return endClientIdValidation
      if (parentEndClientId === null) return { ok: true, data: { endClientId: endClientIdValidation.data, parentEndClientId } }
      const parentEndClientIdValidation = validateUuid(parentEndClientId, ENTITY_NOT_FOUND_MESSAGES.endClient)
      if (!parentEndClientIdValidation.ok) return parentEndClientIdValidation
      return {
        ok: true,
        data: { endClientId: endClientIdValidation.data, parentEndClientId: parentEndClientIdValidation.data },
      }
    },
    operation: (supabase, userId, validatedArguments) =>
      assignEndClientParent(supabase, userId, validatedArguments.endClientId, validatedArguments.parentEndClientId),
  })

export const getContactDetails = async (contactId: string): Promise<ActionResult<ContactDetails>> =>
  runAuthenticatedOperation({
    operationName: 'getContactDetails',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateUuid(contactId, ENTITY_NOT_FOUND_MESSAGES.contact),
    operation: (supabase, userId, validatedContactId) => findContactDetails(supabase, userId, validatedContactId),
  })

export const updateContactDetails = async (
  contactId: string,
  input: ContactDetailsInput,
): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'updateContactDetails',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ contactId: string; input: ContactDetailsInput }> => {
      const contactIdValidation = validateUuid(contactId, ENTITY_NOT_FOUND_MESSAGES.contact)
      if (!contactIdValidation.ok) return contactIdValidation
      const inputValidation = validateContactDetailsInput(input)
      if (!inputValidation.ok) return inputValidation
      return { ok: true, data: { contactId: contactIdValidation.data, input: inputValidation.data } }
    },
    operation: (supabase, userId, validatedArguments) =>
      saveContactDetails(supabase, userId, validatedArguments.contactId, validatedArguments.input),
  })

export const updateIntermediaryKind = async (
  intermediaryId: string,
  kind: IntermediaryKind,
): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'updateIntermediaryKind',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ intermediaryId: string; kind: IntermediaryKind }> => {
      const intermediaryIdValidation = validateUuid(intermediaryId, ENTITY_NOT_FOUND_MESSAGES.intermediary)
      if (!intermediaryIdValidation.ok) return intermediaryIdValidation
      const kindValidation = validateIntermediaryKind(kind)
      if (!kindValidation.ok) return kindValidation
      return { ok: true, data: { intermediaryId: intermediaryIdValidation.data, kind: kindValidation.data } }
    },
    operation: (supabase, userId, validatedArguments) =>
      saveIntermediaryKind(supabase, userId, validatedArguments.intermediaryId, validatedArguments.kind),
  })
