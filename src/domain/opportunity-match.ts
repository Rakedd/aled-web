import { AI_ERROR_MESSAGES, type AiErrorKind } from './ai-errors'
import { normalizeEntityName } from './entity-names'
import { pluralizeFrench } from './french-plural'
import { MAXIMUM_SKILL_COUNT } from './opportunity-filters'

export type OpportunityMatch = {
  matchedSkills: string[]
  missingSkills: string[]
  matchedCount: number
  totalCount: number
  percent: number
}

export type OpportunityMatchLevel = 'strong' | 'good' | 'weak'

export type OpportunityMatchLevelDescription = { level: OpportunityMatchLevel; label: string }

export type SkillListMerge = { skills: string[]; addedCount: number; leftOutCount: number }

export const MAXIMUM_EXTRACTED_SKILL_COUNT = 60

export const OPPORTUNITY_MATCH_LEVEL_LABELS: Record<OpportunityMatchLevel, string> = {
  strong: 'Très bon match',
  good: 'Bon match',
  weak: 'Match faible',
}

export const OPPORTUNITY_MATCH_MESSAGES = {
  sortByMatch: 'Meilleur match',
  missingSkillsHintBeforeLink: 'Ajoute tes compétences dans ',
  missingSkillsHintLink: 'tes filtres',
  missingSkillsHintAfterLink: ' pour voir ton taux de match.',
  opportunitySkillsLabel: 'Compétences demandées',
  sharedSkillSuffix: ' (en commun)',
  mySkillsTitle: 'Mes compétences',
  mySkillsInputLabel: 'Tes technos, une par une',
  mySkillsHelpText: 'Elles servent à calculer ton taux de match sur chaque mission. Elles ne filtrent rien.',
  fillFromCvTitle: 'Remplir depuis mon CV',
  cvSelectLabel: 'CV à analyser',
  extractSkills: 'Extraire les compétences',
  extractingSkills: 'Extraction…',
  skillExtractionFeature: "l'extraction de tes compétences depuis ton CV",
  noCvBeforeLink: 'Ajoute un CV dans ',
  noCvLink: 'Mes CV',
  noCvAfterLink: ' pour remplir ta liste automatiquement.',
  invalidCv: 'Choisis un CV de ta bibliothèque.',
  sortGroupLabel: 'Tri',
  extractionFailure: "Impossible d'extraire tes compétences pour le moment. Réessaie dans quelques minutes.",
} as const

export const OPPORTUNITY_SKILLS_AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  ...AI_ERROR_MESSAGES,
  missing_api_key: 'Ajoute ta clé Claude dans tes préférences pour extraire tes compétences.',
  refused: "Claude n'a pas pu lire ce CV. Ajoute tes compétences à la main.",
  input_too_long: 'Ce CV est trop volumineux pour Claude. Ajoute tes compétences à la main.',
  unknown: "L'extraction a échoué. Ajoute tes compétences à la main.",
}

const SKILL_SEPARATOR_PATTERN = /[\s._-]/g
const JAVASCRIPT_SUFFIX = 'js'
const MINIMUM_LENGTH_BEFORE_JAVASCRIPT_SUFFIX = 2
const NAMES_KEEPING_JAVASCRIPT_SUFFIX: ReadonlySet<string> = new Set([
  'angularjs',
  'solidjs',
  'emberjs',
  'nestjs',
  'nextjs',
  'nuxtjs',
])
const STRONG_MATCH_MINIMUM_PERCENT = 70
const GOOD_MATCH_MINIMUM_PERCENT = 40

const SKILL_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  k8s: 'kubernetes',
  postgres: 'postgresql',
  postgre: 'postgresql',
  golang: 'go',
}

const removeJavascriptSuffix = (compactName: string): string => {
  if (!compactName.endsWith(JAVASCRIPT_SUFFIX) || NAMES_KEEPING_JAVASCRIPT_SUFFIX.has(compactName)) return compactName
  const nameWithoutSuffix = compactName.slice(0, -JAVASCRIPT_SUFFIX.length)
  return nameWithoutSuffix.length >= MINIMUM_LENGTH_BEFORE_JAVASCRIPT_SUFFIX ? nameWithoutSuffix : compactName
}

export const normalizeSkillName = (name: string): string => {
  const compactName = normalizeEntityName(name).replace(SKILL_SEPARATOR_PATTERN, '')
  const nameWithoutSuffix = removeJavascriptSuffix(compactName)
  return SKILL_ALIASES[nameWithoutSuffix] ?? nameWithoutSuffix
}

type KeyedSkill = { key: string; name: string }

const toUniqueKeyedSkills = (skills: string[]): KeyedSkill[] => {
  const seenKeys = new Set<string>()
  const uniqueKeyedSkills: KeyedSkill[] = []
  for (const skill of skills) {
    const key = normalizeSkillName(skill)
    if (key === '' || seenKeys.has(key)) continue
    seenKeys.add(key)
    uniqueKeyedSkills.push({ key, name: skill.trim() })
  }
  return uniqueKeyedSkills
}

export const toUniqueSkillNames = (skills: string[]): string[] => toUniqueKeyedSkills(skills).map(({ name }) => name)

export const createOpportunityMatchCalculator = (
  mySkills: string[],
): ((opportunitySkills: string[]) => OpportunityMatch | null) => {
  const mySkillKeys = new Set(toUniqueKeyedSkills(mySkills).map(({ key }) => key))
  return (opportunitySkills) => {
    const opportunityKeyedSkills = toUniqueKeyedSkills(opportunitySkills)
    if (opportunityKeyedSkills.length === 0 || mySkillKeys.size === 0) return null
    const matchedSkills = opportunityKeyedSkills.filter(({ key }) => mySkillKeys.has(key)).map(({ name }) => name)
    const missingSkills = opportunityKeyedSkills.filter(({ key }) => !mySkillKeys.has(key)).map(({ name }) => name)
    return {
      matchedSkills,
      missingSkills,
      matchedCount: matchedSkills.length,
      totalCount: opportunityKeyedSkills.length,
      percent: Math.round((matchedSkills.length / opportunityKeyedSkills.length) * 100),
    }
  }
}

export const computeOpportunityMatch = (opportunitySkills: string[], mySkills: string[]): OpportunityMatch | null =>
  createOpportunityMatchCalculator(mySkills)(opportunitySkills)

const toOpportunityMatchLevel = (percent: number): OpportunityMatchLevel => {
  if (percent >= STRONG_MATCH_MINIMUM_PERCENT) return 'strong'
  return percent >= GOOD_MATCH_MINIMUM_PERCENT ? 'good' : 'weak'
}

export const describeOpportunityMatchLevel = (percent: number): OpportunityMatchLevelDescription => {
  const level = toOpportunityMatchLevel(percent)
  return { level, label: OPPORTUNITY_MATCH_LEVEL_LABELS[level] }
}

export const formatOpportunityMatchPercent = (percent: number): string => `${percent}\u00a0% match`

type OpportunityMatchCounts = Pick<OpportunityMatch, 'matchedCount' | 'totalCount' | 'percent'>

export const describeOpportunityMatchForScreenReaders = ({ matchedCount, totalCount, percent }: OpportunityMatchCounts): string =>
  `Correspondance avec tes compétences : ${matchedCount} sur ${totalCount} (${describeOpportunityMatchLevel(percent).label})`

export const formatOpportunityMatchSummary = ({ matchedCount, totalCount, percent }: OpportunityMatchCounts): string =>
  `${describeOpportunityMatchLevel(percent).label} · ${matchedCount} ${pluralizeFrench(matchedCount, 'compétence', 'compétences')} en commun sur ${totalCount}`

export const mergeSkillLists = (currentSkills: string[], extractedSkills: string[]): SkillListMerge => {
  const knownKeys = new Set(currentSkills.map(normalizeSkillName))
  const newSkills = toUniqueKeyedSkills(extractedSkills)
    .filter(({ key }) => !knownKeys.has(key))
    .map(({ name }) => name)
  const addedSkills = newSkills.slice(0, Math.max(0, MAXIMUM_SKILL_COUNT - currentSkills.length))
  return {
    skills: [...currentSkills, ...addedSkills],
    addedCount: addedSkills.length,
    leftOutCount: newSkills.length - addedSkills.length,
  }
}

const formatAddedSkillCount = (addedCount: number): string =>
  addedCount === 0
    ? 'Aucune compétence ajoutée'
    : `${addedCount} ${pluralizeFrench(addedCount, 'compétence ajoutée', 'compétences ajoutées')}`

export const formatSkillExtractionOutcome = ({ addedCount, leftOutCount }: Omit<SkillListMerge, 'skills'>): string => {
  if (leftOutCount === 0) {
    return addedCount === 0
      ? 'Aucune nouvelle compétence trouvée dans ce CV.'
      : `${formatAddedSkillCount(addedCount)}. Pense à enregistrer.`
  }
  const leftOutText = `${leftOutCount} ${pluralizeFrench(leftOutCount, 'ignorée', 'ignorées')} : ${MAXIMUM_SKILL_COUNT} au maximum.`
  const saveReminder = addedCount === 0 ? '' : ' Pense à enregistrer.'
  return `${formatAddedSkillCount(addedCount)}, ${leftOutText}${saveReminder}`
}

export const describeHiddenSkillCount = (hiddenSkillCount: number): string =>
  `${hiddenSkillCount} ${pluralizeFrench(hiddenSkillCount, 'autre compétence', 'autres compétences')}`
