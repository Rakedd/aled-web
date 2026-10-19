import { splitBriefHighlights } from './brief-highlights'

describe('splitBriefHighlights', () => {
  it('extracts the key figures and key dates sections and keeps the rest in order', () => {
    const markdown = [
      'Intro',
      '',
      '## Enjeux',
      'Croissance',
      '',
      '## Chiffres clés',
      '- CA : 1 Md€',
      '',
      '## Dates clés',
      '- 2024 : fusion',
      '',
      '## Actualités',
      'News',
    ].join('\n')

    const { highlights, rest } = splitBriefHighlights(markdown)

    expect(highlights.map((highlight) => highlight.title)).toEqual(['Chiffres clés', 'Dates clés'])
    expect(highlights[0].markdown).toContain('CA : 1 Md€')
    expect(highlights[0].markdown).not.toContain('Croissance')
    expect(rest).toContain('Intro')
    expect(rest).toContain('## Enjeux')
    expect(rest).toContain('## Actualités')
    expect(rest).not.toContain('Chiffres clés')
    expect(rest).not.toContain('fusion')
  })

  it('recognises the English headings case-insensitively', () => {
    const { highlights } = splitBriefHighlights('## KEY FIGURES\n- Revenue\n\n## key dates\n- 2020')
    expect(highlights.map((highlight) => highlight.title)).toEqual(['KEY FIGURES', 'key dates'])
  })

  it('returns the whole markdown as rest when there is no highlight section', () => {
    expect(splitBriefHighlights('## Enjeux\nTexte')).toEqual({ highlights: [], rest: '## Enjeux\nTexte' })
  })

  it('keeps both sections when a highlight heading is repeated', () => {
    const { highlights } = splitBriefHighlights('## Chiffres clés\n- CA\n\n## Chiffres clés\n- Effectif')
    expect(highlights.map((highlight) => highlight.title)).toEqual(['Chiffres clés', 'Chiffres clés'])
    expect(highlights[0].markdown).toContain('CA')
    expect(highlights[1].markdown).toContain('Effectif')
  })

  it('does not treat a sub heading as a section boundary', () => {
    const { highlights } = splitBriefHighlights('## Chiffres clés\n### Détail\n- a')
    expect(highlights).toHaveLength(1)
    expect(highlights[0].markdown).toContain('### Détail')
  })
})
