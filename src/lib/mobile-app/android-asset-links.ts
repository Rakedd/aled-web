export const ANDROID_APP_PACKAGE_NAME = 'work.aled.app'

const SHA256_FINGERPRINT_PATTERN = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/

export type AndroidAssetLink = {
  relation: string[]
  target: { namespace: 'android_app'; package_name: string; sha256_cert_fingerprints: string[] }
}

export const parseAndroidCertificateFingerprints = (rawValue: string | undefined): string[] =>
  (rawValue ?? '')
    .split(',')
    .map((fingerprint) => fingerprint.trim().toUpperCase())
    .filter((fingerprint) => {
      if (fingerprint.length === 0) return false
      if (SHA256_FINGERPRINT_PATTERN.test(fingerprint)) return true
      console.warn('Ignored an invalid Android certificate fingerprint')
      return false
    })

export const buildAndroidAssetLinks = (certificateFingerprints: string[]): AndroidAssetLink[] =>
  certificateFingerprints.length === 0
    ? []
    : [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: ANDROID_APP_PACKAGE_NAME,
            sha256_cert_fingerprints: certificateFingerprints,
          },
        },
      ]
