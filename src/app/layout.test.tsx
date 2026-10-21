import { renderToStaticMarkup } from 'react-dom/server'
import { THEME_INIT_SCRIPT } from '@/lib/theme/theme-init-script'
import RootLayout, { metadata } from './layout'

jest.mock('next/font/google', () => ({
  Manrope: () => ({ variable: 'font' }),
  Figtree: () => ({ variable: 'font' }),
}))

describe('RootLayout', () => {
  it('runs the theme script in the head before the body', () => {
    const markup = renderToStaticMarkup(
      <RootLayout params={Promise.resolve({})}>
        <main />
      </RootLayout>,
    )
    const themeScriptMarkup = `<head><script>${THEME_INIT_SCRIPT}</script>`

    expect(markup).toContain(themeScriptMarkup)
    expect(markup.indexOf(themeScriptMarkup)).toBeLessThan(markup.indexOf('<body'))
  })
})

describe('root metadata', () => {
  it('keeps the app pages out of search engines by default', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})
