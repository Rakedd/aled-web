import type { NextRequest } from 'next/server'

export const buildAuthRedirectUrl = (
  request: NextRequest,
  pathname: string,
  searchParameters: Record<string, string> = {},
): URL => {
  const redirectUrl = new URL(pathname, request.url)
  redirectUrl.search = new URLSearchParams(searchParameters).toString()
  return redirectUrl
}
