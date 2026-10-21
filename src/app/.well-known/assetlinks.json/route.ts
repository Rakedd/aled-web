import { buildAndroidAssetLinks, parseAndroidCertificateFingerprints } from '@/lib/mobile-app/android-asset-links'

export const dynamic = 'force-static'

export const GET = () =>
  Response.json(buildAndroidAssetLinks(parseAndroidCertificateFingerprints(process.env.ANDROID_APP_SHA256_FINGERPRINTS)))
