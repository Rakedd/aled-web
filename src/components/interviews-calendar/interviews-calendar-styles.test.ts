import { readFileSync } from 'fs'
import { join } from 'path'

const readFile = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), 'utf8')

const FULLCALENDAR_CSS_FILES = [
  'node_modules/@fullcalendar/react/themes/classic/theme.css',
  'node_modules/@fullcalendar/react/themes/classic/palette.css',
  'node_modules/@fullcalendar/react/skeleton.css',
]

const componentCss = readFile('src/components/interviews-calendar/interviews-calendar.css')
const componentSource = readFile('src/components/interviews-calendar/interviews-calendar.tsx')
const fullCalendarCss = FULLCALENDAR_CSS_FILES.map((filePath) => readFile(filePath)).join('\n')

describe('interviews calendar styles', () => {
  it('only overrides FullCalendar variables that the installed theme defines', () => {
    const overriddenVariables = [...componentCss.matchAll(/^\s*(--fc-[a-z-]+):/gm)].map((match) => match[1])

    expect(overriddenVariables.length).toBeGreaterThan(0)
    overriddenVariables.forEach((variableName) => {
      expect(fullCalendarCss).toContain(variableName)
    })
  })

  it('only reads FullCalendar variables that the installed theme defines', () => {
    const readVariables = [...componentCss.matchAll(/var\((--fc-[a-z-]+)/g)].map((match) => match[1])

    readVariables.forEach((variableName) => {
      expect(fullCalendarCss).toContain(variableName)
    })
  })

  it('styles only class names that the component hands to FullCalendar', () => {
    const styledClassNames = [...new Set([...componentCss.matchAll(/\.(fc-atelier-[a-z-]+)/g)].map((match) => match[1]))]

    expect(styledClassNames.length).toBeGreaterThan(0)
    styledClassNames.forEach((className) => {
      expect(componentSource).toContain(className)
    })
  })

  it('does not rely on legacy FullCalendar class names that the installed version no longer ships', () => {
    expect(componentCss).not.toMatch(/\.fc-(toolbar|button|daygrid|event|day-today)\b/)
  })
})
