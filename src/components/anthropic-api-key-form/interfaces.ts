import type { ActionResult } from '@/domain/action-result'

export type SaveAnthropicApiKey = (plainApiKey: string) => Promise<ActionResult<{ lastFour: string }>>
export type DeleteAnthropicApiKey = () => Promise<ActionResult<null>>

export type AnthropicApiKeyFormStatus = 'idle' | 'saving' | 'deleting'

export type AnthropicApiKeyFormControllerParameters = {
  initialApiKeyLastFour: string | null
  saveAnthropicApiKey: SaveAnthropicApiKey
  deleteAnthropicApiKey: DeleteAnthropicApiKey
}

export type AnthropicApiKeyFormProps = AnthropicApiKeyFormControllerParameters
