export type BriefHighlight = { title: string; markdown: string }

export type SplitBrief = { highlights: BriefHighlight[]; rest: string }

const HIGHLIGHT_TITLES = ['chiffres clés', 'dates clés', 'key figures', 'key dates']
const SECTION_HEADING_PATTERN = /^##\s+(.+?)\s*$/

type BriefSection = { title: string | null; lines: string[] }

const isHighlightSection = (section: BriefSection): section is BriefSection & { title: string } =>
  section.title !== null && HIGHLIGHT_TITLES.includes(section.title.toLowerCase())

const splitIntoSections = (markdown: string): BriefSection[] => {
  const sections: BriefSection[] = [{ title: null, lines: [] }]
  markdown.split('\n').forEach((line) => {
    const headingMatch = SECTION_HEADING_PATTERN.exec(line)
    if (headingMatch) sections.push({ title: headingMatch[1], lines: [line] })
    else sections[sections.length - 1].lines.push(line)
  })
  return sections
}

export const splitBriefHighlights = (markdown: string): SplitBrief => {
  const sections = splitIntoSections(markdown)
  const highlights = sections
    .filter(isHighlightSection)
    .map((section) => ({ title: section.title, markdown: section.lines.join('\n') }))
  const rest = sections
    .filter((section) => !isHighlightSection(section) && section.lines.length > 0)
    .map((section) => section.lines.join('\n'))
    .join('\n')
  return { highlights, rest }
}
