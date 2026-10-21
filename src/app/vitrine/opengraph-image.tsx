import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { LANDING_COPY } from '@/domain/landing-copy'
import { readLightThemeColour } from '@/lib/theme/read-light-theme-colour'

export const alt = 'Aled — Trouver du boulot depuis ton canapé'

export const size = { width: 1200, height: 630 }

export const contentType = 'image/png'

const OpenGraphImage = async () => {
  const [manropeExtraBold, logo] = await Promise.all([
    readFile(path.join(process.cwd(), 'assets/fonts/manrope-latin-800-normal.woff')),
    readFile(path.join(process.cwd(), 'public/brand/aled-logo-on-dark.png')),
  ])
  const titleLineStyle = { fontSize: 76, lineHeight: 1.1, color: readLightThemeColour('on-brand-tile') }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: readLightThemeColour('brand-tile'),
          fontFamily: 'Manrope',
        }}
      >
        <img src={`data:image/png;base64,${logo.toString('base64')}`} width={241} height={108} alt="Aled" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={titleLineStyle}>{LANDING_COPY.hero.titleStart}</div>
          <div
            style={{
              ...titleLineStyle,
              color: readLightThemeColour('on-brand-tile-secondary'),
              textDecoration: 'line-through',
              textDecorationColor: readLightThemeColour('peach'),
            }}
          >
            {LANDING_COPY.hero.struckText}
          </div>
          <div style={titleLineStyle}>{LANDING_COPY.hero.titleEnd}</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Manrope', data: manropeExtraBold, weight: 800, style: 'normal' }] },
  )
}

export default OpenGraphImage
