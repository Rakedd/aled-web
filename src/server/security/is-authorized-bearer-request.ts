import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

const hashForConstantTimeComparison = (secretCandidate: string): Buffer =>
  createHash('sha256').update(secretCandidate).digest()

export const isAuthorizedBearerRequest = (request: Request, expectedSecret: string | undefined): boolean => {
  if (!expectedSecret) return false
  return timingSafeEqual(
    hashForConstantTimeComparison(request.headers.get('authorization') ?? ''),
    hashForConstantTimeComparison(`Bearer ${expectedSecret}`),
  )
}
