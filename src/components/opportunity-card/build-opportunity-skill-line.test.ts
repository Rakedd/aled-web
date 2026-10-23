import { buildOpportunitySkillLine } from './build-opportunity-skill-line'

describe('buildOpportunitySkillLine', () => {
  it('puts the shared skills first, then the others, with the match', () => {
    const skillLine = buildOpportunitySkillLine(['GraphQL', 'React.js', 'Java', 'TS'], ['react', 'TypeScript'])

    expect(skillLine.match?.percent).toBe(50)
    expect(skillLine.visibleSkills).toEqual([
      { name: 'React.js', isShared: true },
      { name: 'TS', isShared: true },
      { name: 'GraphQL', isShared: false },
      { name: 'Java', isShared: false },
    ])
    expect(skillLine.hiddenSkillCount).toBe(0)
  })

  it('lists the deduplicated opportunity skills without match when I have no skill', () => {
    expect(buildOpportunitySkillLine(['React', ' reactjs ', 'Java'], [])).toEqual({
      match: null,
      visibleSkills: [
        { name: 'React', isShared: false },
        { name: 'Java', isShared: false },
      ],
      hiddenSkillCount: 0,
    })
  })

  it('keeps eight skills visible and counts the hidden ones', () => {
    const skillLine = buildOpportunitySkillLine(
      Array.from({ length: 10 }, (_, index) => `Techno ${index}`),
      ['Techno 9'],
    )

    expect(skillLine.visibleSkills).toHaveLength(8)
    expect(skillLine.visibleSkills[0]).toEqual({ name: 'Techno 9', isShared: true })
    expect(skillLine.hiddenSkillCount).toBe(2)
  })

  it('is empty for an opportunity without skills', () => {
    expect(buildOpportunitySkillLine([], ['React'])).toEqual({ match: null, visibleSkills: [], hiddenSkillCount: 0 })
  })
})
