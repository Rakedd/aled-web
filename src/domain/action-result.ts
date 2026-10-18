export type ActionResult<T> = { ok: true; data: T } | { ok: false; errorMessage: string }

export const GENERIC_ACTION_ERROR_MESSAGE = 'Une erreur est survenue, réessaie.'

export const guardActionCall = async <T>(actionCall: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> => {
  try {
    return await actionCall()
  } catch {
    return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE }
  }
}
