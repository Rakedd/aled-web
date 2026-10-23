interface LinkedinLinkBaseProps {
  url: string
}

interface LinkedinLinkFullProps extends LinkedinLinkBaseProps {
  isCompact?: false
  label?: string
}

interface LinkedinLinkCompactProps extends LinkedinLinkBaseProps {
  isCompact: true
  label: string
}

export type LinkedinLinkProps = LinkedinLinkFullProps | LinkedinLinkCompactProps
