import { ANDROID_APP_PACKAGE_NAME, buildAndroidAssetLinks, parseAndroidCertificateFingerprints } from './android-asset-links'

const FINGERPRINT = 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89'

describe('parseAndroidCertificateFingerprints', () => {
  it('reads a comma separated list and normalises the case', () => {
    expect(parseAndroidCertificateFingerprints(` ${FINGERPRINT.toLowerCase()} ,,${FINGERPRINT}`)).toEqual([FINGERPRINT, FINGERPRINT])
  })

  it('returns no fingerprint when the variable is missing', () => {
    expect(parseAndroidCertificateFingerprints(undefined)).toEqual([])
  })

  it('ignores a value that is not a SHA-256 fingerprint', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(parseAndroidCertificateFingerprints('pas-une-empreinte')).toEqual([])
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
})

describe('buildAndroidAssetLinks', () => {
  it('lets the Aled Android app open app links', () => {
    expect(buildAndroidAssetLinks([FINGERPRINT])).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: ANDROID_APP_PACKAGE_NAME, sha256_cert_fingerprints: [FINGERPRINT] },
      },
    ])
    expect(ANDROID_APP_PACKAGE_NAME).toBe('work.aled.app')
  })

  it('declares no app until a signing fingerprint is configured', () => {
    expect(buildAndroidAssetLinks([])).toEqual([])
  })
})
