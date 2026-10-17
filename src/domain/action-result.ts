export type ActionResult<T> = { ok: true; data: T } | { ok: false; errorMessage: string }

export const GENERIC_ACTION_ERROR_MESSAGE = 'Une erreur est survenue, réessaie.'
