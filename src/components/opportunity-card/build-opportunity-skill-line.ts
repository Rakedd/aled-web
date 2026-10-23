import { computeOpportunityMatch, toUniqueSkillNames } from '@/domain/opportunity-match'
import type { OpportunitySkillChip, OpportunitySkillLine } from './interfaces'

const MAXIMUM_VISIBLE_SKILL_COUNT = 8

const toSkillChips = (skillNames: string[], isShared: boolean): OpportunitySkillChip[] =>
  skillNames.map((name) => ({ name, isShared }))

export const buildOpportunitySkillLine = (opportunitySkills: string[], mySkills: string[]): OpportunitySkillLine => {
  const match = computeOpportunityMatch(opportunitySkills, mySkills)
  const orderedSkillChips =
    match === null
      ? toSkillChips(toUniqueSkillNames(opportunitySkills), false)
      : [...toSkillChips(match.matchedSkills, true), ...toSkillChips(match.missingSkills, false)]
  return {
    match,
    visibleSkills: orderedSkillChips.slice(0, MAXIMUM_VISIBLE_SKILL_COUNT),
    hiddenSkillCount: Math.max(0, orderedSkillChips.length - MAXIMUM_VISIBLE_SKILL_COUNT),
  }
}
