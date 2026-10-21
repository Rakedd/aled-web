import Link from 'next/link'
import type { BrandLogoLinkProps } from './interfaces'

export const BrandLogoLink = ({ href }: BrandLogoLinkProps) => (
  <Link href={href} className="block h-9 w-20 shrink-0 bg-(image:--brand-logo) bg-contain bg-left bg-no-repeat">
    <span className="sr-only">Aled</span>
  </Link>
)
