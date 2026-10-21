'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import {
  type ContactExchangeInput,
  type ContactListItem,
  type ContactPageData,
  type ContactProfileInput,
  type IntermediaryListItem,
  type IntermediaryPageData,
  validateContactExchangeInput,
  validateContactProfileInput,
} from '@/domain/contacts'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { validateUuid } from '@/domain/input-validation'
import {
  deleteContactRow,
  findContactProfile,
  insertContact,
  listContactListItems,
  listContactListItemsForIntermediary,
  saveContactProfile,
} from '@/server/repositories/contacts-repository'
import {
  listExchangesForContact,
  listExchangesForIntermediary,
  recordContactExchange,
} from '@/server/repositories/exchanges-repository'
import { findIntermediaryListItem, listIntermediaryListItems } from '@/server/repositories/intermediaries-repository'
import {
  listProposedMissionsForContact,
  listProposedMissionsForIntermediary,
} from '@/server/repositories/job-applications-repository'
import { runAuthenticatedOperation } from './run-authenticated-operation'

const LOAD_FAILURE_MESSAGE = 'Impossible de charger ces informations pour le moment. Réessaie dans quelques minutes.'
const SAVE_FAILURE_MESSAGE = "Impossible d'enregistrer pour le moment. Réessaie dans quelques minutes."

export const listContacts = async (): Promise<ActionResult<ContactListItem[]>> =>
  runAuthenticatedOperation({
    operationName: 'listContacts',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => ({ ok: true, data: null }),
    operation: async (supabase, userId) => ({ ok: true, data: await listContactListItems(supabase, userId) }),
  })

export const listIntermediaries = async (): Promise<ActionResult<IntermediaryListItem[]>> =>
  runAuthenticatedOperation({
    operationName: 'listIntermediaries',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => ({ ok: true, data: null }),
    operation: async (supabase, userId) => ({ ok: true, data: await listIntermediaryListItems(supabase, userId) }),
  })

export const getContactPage = async (contactId: string): Promise<ActionResult<ContactPageData>> =>
  runAuthenticatedOperation({
    operationName: 'getContactPage',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateUuid(contactId, ENTITY_NOT_FOUND_MESSAGES.contact),
    operation: async (supabase, userId, validatedContactId) => {
      const profileResult = await findContactProfile(supabase, userId, validatedContactId)
      if (!profileResult.ok) return profileResult
      const [proposedMissions, exchanges] = await Promise.all([
        listProposedMissionsForContact(supabase, userId, validatedContactId),
        listExchangesForContact(supabase, userId, validatedContactId),
      ])
      return { ok: true, data: { profile: profileResult.data, proposedMissions, exchanges } }
    },
  })

export const getIntermediaryPage = async (intermediaryId: string): Promise<ActionResult<IntermediaryPageData>> =>
  runAuthenticatedOperation({
    operationName: 'getIntermediaryPage',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateUuid(intermediaryId, ENTITY_NOT_FOUND_MESSAGES.intermediary),
    operation: async (supabase, userId, validatedIntermediaryId) => {
      const intermediaryResult = await findIntermediaryListItem(supabase, userId, validatedIntermediaryId)
      if (!intermediaryResult.ok) return intermediaryResult
      const [contacts, exchanges, proposedMissions] = await Promise.all([
        listContactListItemsForIntermediary(supabase, userId, validatedIntermediaryId),
        listExchangesForIntermediary(supabase, userId, validatedIntermediaryId),
        listProposedMissionsForIntermediary(supabase, userId, validatedIntermediaryId),
      ])
      return { ok: true, data: { intermediary: intermediaryResult.data, contacts, exchanges, proposedMissions } }
    },
  })

export const createContact = async (input: ContactProfileInput): Promise<ActionResult<{ id: string }>> =>
  runAuthenticatedOperation({
    operationName: 'createContact',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateContactProfileInput(input),
    operation: (supabase, userId, validatedInput) => insertContact(supabase, userId, validatedInput),
  })

export const updateContactProfile = async (
  contactId: string,
  input: ContactProfileInput,
): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'updateContactProfile',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ contactId: string; input: ContactProfileInput }> => {
      const contactIdValidation = validateUuid(contactId, ENTITY_NOT_FOUND_MESSAGES.contact)
      if (!contactIdValidation.ok) return contactIdValidation
      const inputValidation = validateContactProfileInput(input)
      if (!inputValidation.ok) return inputValidation
      return { ok: true, data: { contactId: contactIdValidation.data, input: inputValidation.data } }
    },
    operation: (supabase, userId, validatedArguments) =>
      saveContactProfile(supabase, userId, validatedArguments.contactId, validatedArguments.input),
  })

export const deleteContact = async (contactId: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'deleteContact',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateUuid(contactId, ENTITY_NOT_FOUND_MESSAGES.contact),
    operation: async (supabase, _userId, validatedContactId) =>
      (await deleteContactRow(supabase, validatedContactId))
        ? { ok: true, data: null }
        : { ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact },
  })

export const addContactExchange = async (
  contactId: string,
  input: ContactExchangeInput,
): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'addContactExchange',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ contactId: string; input: ContactExchangeInput }> => {
      const contactIdValidation = validateUuid(contactId, ENTITY_NOT_FOUND_MESSAGES.contact)
      if (!contactIdValidation.ok) return contactIdValidation
      const inputValidation = validateContactExchangeInput(input, new Date())
      if (!inputValidation.ok) return inputValidation
      return { ok: true, data: { contactId: contactIdValidation.data, input: inputValidation.data } }
    },
    operation: (supabase, userId, validatedArguments) =>
      recordContactExchange(supabase, userId, validatedArguments.contactId, validatedArguments.input),
  })
