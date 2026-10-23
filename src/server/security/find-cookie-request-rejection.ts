import 'server-only'

export type CookieRequestRejection = 'cross_site' | 'not_json'

const JSON_CONTENT_TYPE = 'application/json'
const SAME_ORIGIN_FETCH_SITE = 'same-origin'

const isJsonContentType = (contentType: string | null): boolean =>
  contentType?.split(';')[0].trim().toLowerCase() === JSON_CONTENT_TYPE

export const findCookieRequestRejection = (request: Request): CookieRequestRejection | null => {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite !== null && fetchSite !== SAME_ORIGIN_FETCH_SITE) return 'cross_site'
  return isJsonContentType(request.headers.get('content-type')) ? null : 'not_json'
}
