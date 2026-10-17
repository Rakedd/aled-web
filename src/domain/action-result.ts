export type ActionResult<T> = { ok: true; data: T } | { ok: false; errorMessage: string }
