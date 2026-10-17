import 'server-only'
import { z } from 'zod'
import { STACK_CATEGORIES, type StackItem, type StackItemOrigin } from '@/domain/types'

export const extractedStackItemSchema = z.object({
  name: z.string(),
  category: z.enum(STACK_CATEGORIES).catch('other'),
})

type ExtractedStackItem = z.infer<typeof extractedStackItemSchema>

export const toStackItems = (extractedStackItems: ExtractedStackItem[], origin: StackItemOrigin): StackItem[] =>
  extractedStackItems.map((extractedStackItem) => ({
    name: extractedStackItem.name,
    category: extractedStackItem.category,
    origin,
  }))
