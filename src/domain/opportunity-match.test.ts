import {
  computeOpportunityMatch,
  createOpportunityMatchCalculator,
  describeOpportunityMatchLevel,
  describeHiddenSkillCount,
  describeOpportunityMatchForScreenReaders,
  formatOpportunityMatchPercent,
  formatOpportunityMatchSummary,
  formatSkillExtractionOutcome,
  mergeSkillLists,
  normalizeSkillName,
  toUniqueSkillNames,
} from './opportunity-match'

describe('normalizeSkillName', () => {
  it.each([
    ['React.js', 'react'],
    ['reactjs', 'react'],
    ['React', 'react'],
    ['Node.js', 'node'],
    ['Vue.js', 'vue'],
    ['VueJS', 'vue'],
    ['Vue JS', 'vue'],
    ['  Spring   Boot ', 'springboot'],
    ['CI/CD', 'ci/cd'],
    ['Scikit_Learn', 'scikitlearn'],
    ['Élasticsearch', 'elasticsearch'],
    ['C#', 'c#'],
    ['C', 'c'],
    ['C++', 'c++'],
    ['.NET', 'net'],
    ['dotnet', 'dotnet'],
    ['.NET Core', 'netcore'],
  ])('normalizes %s as %s', (skillName, expectedKey) => {
    expect(normalizeSkillName(skillName)).toBe(expectedKey)
  })

  it.each([
    ['AngularJS', 'angularjs'],
    ['Angular.js', 'angularjs'],
    ['SolidJS', 'solidjs'],
    ['Ember.js', 'emberjs'],
    ['NestJS', 'nestjs'],
    ['Next.js', 'nextjs'],
    ['nextjs', 'nextjs'],
    ['Nuxt.js', 'nuxtjs'],
  ])('keeps the js suffix of the exempted framework %s', (skillName, expectedKey) => {
    expect(normalizeSkillName(skillName)).toBe(expectedKey)
  })

  it('tells apart the exempted frameworks from their js-less homonyms', () => {
    expect(normalizeSkillName('Next.js')).not.toBe(normalizeSkillName('Next'))
    expect(normalizeSkillName('AngularJS')).not.toBe(normalizeSkillName('Angular'))
    expect(normalizeSkillName('SolidJS')).not.toBe(normalizeSkillName('SOLID'))
  })

  it('removes the js suffix only when at least two characters remain', () => {
    expect(normalizeSkillName('D3.js')).toBe('d3')
    expect(normalizeSkillName('a.js')).toBe('ajs')
  })

  it.each([
    ['TS', 'typescript'],
    ['JS', 'javascript'],
    ['K8s', 'kubernetes'],
    ['Postgres', 'postgresql'],
    ['postgre', 'postgresql'],
    ['PostgreSQL', 'postgresql'],
    ['Golang', 'go'],
    ['Go', 'go'],
  ])('resolves the alias %s to %s', (skillName, expectedKey) => {
    expect(normalizeSkillName(skillName)).toBe(expectedKey)
  })

  it('returns an empty key for a blank or punctuation-only name', () => {
    expect(normalizeSkillName('   ')).toBe('')
    expect(normalizeSkillName(' .-_ ')).toBe('')
  })
})

describe('computeOpportunityMatch', () => {
  it('counts the opportunity skills found in my skills, in the opportunity spelling', () => {
    expect(computeOpportunityMatch(['React.js', 'TypeScript', 'Kubernetes', 'GraphQL'], ['react', 'TS', 'k8s'])).toEqual({
      matchedSkills: ['React.js', 'TypeScript', 'Kubernetes'],
      missingSkills: ['GraphQL'],
      matchedCount: 3,
      totalCount: 4,
      percent: 75,
    })
  })

  it('deduplicates the opportunity skills by normalized key and keeps the first spelling', () => {
    expect(computeOpportunityMatch(['React', 'ReactJS', ' react.js ', 'Java'], ['React'])).toEqual({
      matchedSkills: ['React'],
      missingSkills: ['Java'],
      matchedCount: 1,
      totalCount: 2,
      percent: 50,
    })
  })

  it('trims the opportunity spelling and ignores blank skills', () => {
    expect(computeOpportunityMatch(['  Docker ', '   ', ''], ['docker', ' '])).toEqual({
      matchedSkills: ['Docker'],
      missingSkills: [],
      matchedCount: 1,
      totalCount: 1,
      percent: 100,
    })
  })

  it('rounds the percent to the nearest integer', () => {
    expect(computeOpportunityMatch(['A1', 'B1', 'C1'], ['a1'])?.percent).toBe(33)
    expect(computeOpportunityMatch(['A1', 'B1', 'C1'], ['a1', 'b1'])?.percent).toBe(67)
  })

  it('returns 0 when no skill matches', () => {
    expect(computeOpportunityMatch(['Java'], ['Python'])?.percent).toBe(0)
  })

  it.each([
    ['the opportunity has no skill', [], ['React']],
    ['the opportunity has only blank skills', ['  ', '.'], ['React']],
    ['I have no skill', ['React'], []],
    ['I have only blank skills', ['React'], ['   ']],
  ])('returns null when %s', (_caseName, opportunitySkills, mySkills) => {
    expect(computeOpportunityMatch(opportunitySkills, mySkills)).toBeNull()
  })
})

describe('createOpportunityMatchCalculator', () => {
  it('computes the same match as computeOpportunityMatch for every opportunity, with my skills normalized once', () => {
    const calculateMatch = createOpportunityMatchCalculator(['React', 'TS'])

    expect(calculateMatch(['ReactJS', 'Java'])).toEqual(computeOpportunityMatch(['ReactJS', 'Java'], ['React', 'TS']))
    expect(calculateMatch(['TypeScript'])?.percent).toBe(100)
    expect(calculateMatch([])).toBeNull()
  })

  it('always returns null when I have no skill', () => {
    expect(createOpportunityMatchCalculator([' '])(['React'])).toBeNull()
  })
})

describe('describeOpportunityMatchLevel', () => {
  it.each([
    [100, 'strong', 'Très bon match'],
    [70, 'strong', 'Très bon match'],
    [69, 'good', 'Bon match'],
    [40, 'good', 'Bon match'],
    [39, 'weak', 'Match faible'],
    [0, 'weak', 'Match faible'],
  ])('describes %i %% as %s', (percent, expectedLevel, expectedLabel) => {
    expect(describeOpportunityMatchLevel(percent)).toEqual({ level: expectedLevel, label: expectedLabel })
  })
})

describe('formatOpportunityMatchPercent', () => {
  it('writes the percent with a non-breaking space before the percent sign', () => {
    expect(formatOpportunityMatchPercent(75)).toBe('75\u00a0% match')
  })
})

describe('describeOpportunityMatchForScreenReaders', () => {
  it('states how many opportunity skills I have and the match level', () => {
    expect(describeOpportunityMatchForScreenReaders({ matchedCount: 3, totalCount: 4, percent: 75 })).toBe(
      'Correspondance avec tes compétences : 3 sur 4 (Très bon match)',
    )
    expect(describeOpportunityMatchForScreenReaders({ matchedCount: 1, totalCount: 3, percent: 33 })).toBe(
      'Correspondance avec tes compétences : 1 sur 3 (Match faible)',
    )
  })
})

describe('formatOpportunityMatchSummary', () => {
  it('writes the level and the shared skill count as visible text', () => {
    expect(formatOpportunityMatchSummary({ matchedCount: 3, totalCount: 4, percent: 75 })).toBe(
      'Très bon match · 3 compétences en commun sur 4',
    )
    expect(formatOpportunityMatchSummary({ matchedCount: 1, totalCount: 2, percent: 50 })).toBe(
      'Bon match · 1 compétence en commun sur 2',
    )
  })
})

describe('toUniqueSkillNames', () => {
  it('trims, drops blanks and keeps the first spelling of each normalized skill', () => {
    expect(toUniqueSkillNames([' React ', 'ReactJS', '  ', 'Postgres', 'PostgreSQL', 'Next.js'])).toEqual([
      'React',
      'Postgres',
      'Next.js',
    ])
  })
})

describe('mergeSkillLists', () => {
  it('appends only the extracted skills I do not already have, by normalized key', () => {
    expect(mergeSkillLists(['React', 'TypeScript'], ['ReactJS', 'TS', 'Docker', ' Kubernetes '])).toEqual({
      skills: ['React', 'TypeScript', 'Docker', 'Kubernetes'],
      addedCount: 2,
      leftOutCount: 0,
    })
  })

  it('deduplicates the extracted skills among themselves and skips blank ones', () => {
    expect(mergeSkillLists([], ['Node.js', 'node', '  ', 'Postgres', 'PostgreSQL']).skills).toEqual(['Node.js', 'Postgres'])
  })

  it('keeps my current list untouched when nothing new is extracted', () => {
    expect(mergeSkillLists(['Go'], ['golang'])).toEqual({ skills: ['Go'], addedCount: 0, leftOutCount: 0 })
  })

  it('stops at 100 skills and counts the extracted skills left out', () => {
    const currentSkills = Array.from({ length: 92 }, (_, index) => `Actuelle ${index}`)
    const extractedSkills = ['Actuelle 0', ...Array.from({ length: 20 }, (_, index) => `Nouvelle ${index}`)]

    const mergeResult = mergeSkillLists(currentSkills, extractedSkills)

    expect(mergeResult.skills).toHaveLength(100)
    expect(mergeResult.skills.at(-1)).toBe('Nouvelle 7')
    expect(mergeResult).toEqual(expect.objectContaining({ addedCount: 8, leftOutCount: 12 }))
  })

  it('adds nothing when my list is already full', () => {
    const fullList = Array.from({ length: 100 }, (_, index) => `Actuelle ${index}`)
    expect(mergeSkillLists(fullList, ['Docker'])).toEqual({ skills: fullList, addedCount: 0, leftOutCount: 1 })
  })
})

describe('formatSkillExtractionOutcome', () => {
  it('tells how many skills were added and reminds to save', () => {
    expect(formatSkillExtractionOutcome({ addedCount: 1, leftOutCount: 0 })).toBe('1 compétence ajoutée. Pense à enregistrer.')
    expect(formatSkillExtractionOutcome({ addedCount: 4, leftOutCount: 0 })).toBe(
      '4 compétences ajoutées. Pense à enregistrer.',
    )
  })

  it('says when the CV brought no new skill', () => {
    expect(formatSkillExtractionOutcome({ addedCount: 0, leftOutCount: 0 })).toBe(
      'Aucune nouvelle compétence trouvée dans ce CV.',
    )
  })

  it('says how many skills were left out because of the 100 skills limit', () => {
    expect(formatSkillExtractionOutcome({ addedCount: 12, leftOutCount: 8 })).toBe(
      '12 compétences ajoutées, 8 ignorées : 100 au maximum. Pense à enregistrer.',
    )
    expect(formatSkillExtractionOutcome({ addedCount: 1, leftOutCount: 1 })).toBe(
      '1 compétence ajoutée, 1 ignorée : 100 au maximum. Pense à enregistrer.',
    )
    expect(formatSkillExtractionOutcome({ addedCount: 0, leftOutCount: 3 })).toBe(
      'Aucune compétence ajoutée, 3 ignorées : 100 au maximum.',
    )
  })
})

describe('describeHiddenSkillCount', () => {
  it('tells screen readers how many skills the « +N » hides', () => {
    expect(describeHiddenSkillCount(1)).toBe('1 autre compétence')
    expect(describeHiddenSkillCount(3)).toBe('3 autres compétences')
  })
})
