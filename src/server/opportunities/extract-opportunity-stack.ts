import 'server-only'
import type { StackItem } from '@/domain/types'
import { describeAiErrorForLogs } from '@/server/ai/ai-error'

export type OpportunityStackExtractionDependencies = {
  getApiKey: () => Promise<string | null>
  extract: (apiKey: string, description: string) => Promise<StackItem[]>
}

const tagAsPosting = (stackItems: StackItem[]): StackItem[] =>
  stackItems.map((stackItem) => ({ ...stackItem, origin: 'posting' }))

export const extractOpportunityStack = async (
  dependencies: OpportunityStackExtractionDependencies,
  description: string | null,
): Promise<StackItem[]> => {
  if (description === null || description.trim() === '') return []
  try {
    const apiKey = await dependencies.getApiKey()
    if (apiKey === null) return []
    return tagAsPosting(await dependencies.extract(apiKey, description))
  } catch (extractionError) {
    console.error('Opportunity stack extraction failed', describeAiErrorForLogs(extractionError))
    return []
  }
}
