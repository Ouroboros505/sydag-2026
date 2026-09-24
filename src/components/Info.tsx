import type { ReactNode } from 'react'

/** A small ⓘ that explains what a number or chart means. Hover on desktop, tap on phones. */
export default function Info({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <span className="info" tabIndex={0} role="button" aria-label="What is this?">
      i
      <span className={'infotip' + (wide ? ' wide' : '')} role="tooltip">{children}</span>
    </span>
  )
}
