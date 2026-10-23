import fs from 'node:fs'
import path from 'node:path'

const CONFIRMATION_TEMPLATE = fs.readFileSync(path.join(__dirname, 'confirmation.html'), 'utf8')

describe('confirmation email template', () => {
  it('welcomes every user without assuming a gender or a freelance status', () => {
    expect(CONFIRMATION_TEMPLATE).toContain('Active ton compte pour commencer à suivre tes candidatures.')
    expect(CONFIRMATION_TEMPLATE).not.toMatch(/inscrit|freelance/i)
  })

  it('greets the user only once, in the title', () => {
    expect(CONFIRMATION_TEMPLATE.match(/Bienvenue sur Aled/g)).toHaveLength(1)
    expect(CONFIRMATION_TEMPLATE).toContain('<p style="margin: 0">Active ton compte pour commencer à suivre tes candidatures.</p>')
  })

  it('keeps the activation link on the confirmation route', () => {
    expect(CONFIRMATION_TEMPLATE).toContain('{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email')
  })
})
