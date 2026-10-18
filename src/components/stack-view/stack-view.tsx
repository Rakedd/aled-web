import { MISSING_VALUE_LABEL, groupStackByCategory } from '@/domain/job-application-display'
import type { StackViewProps } from './interfaces'

export const StackView = ({ stack }: StackViewProps) => {
  const stackCategoryGroups = groupStackByCategory(stack)

  if (stackCategoryGroups.length === 0) return <p className="text-sm text-muted-foreground">{MISSING_VALUE_LABEL}</p>

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {stackCategoryGroups.map(({ category, label, names }) => (
        <div key={category} className="flex min-w-0 flex-col gap-1.5">
          <p id={`stack-view-${category}`} className="text-xs font-medium text-muted-foreground uppercase">
            {label}
          </p>
          <ul aria-labelledby={`stack-view-${category}`} className="flex flex-wrap gap-2">
            {names.map((name, nameIndex) => (
              <li
                key={`${name}-${nameIndex}`}
                className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
