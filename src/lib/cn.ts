import clsx, { type ClassValue } from 'clsx'

/**
 * No tailwind-merge on purpose: every primitive in `design/` accepts a
 * `className` that is expected to *extend* the base, not fight it. Conflicts
 * are avoided by keeping variant classes in one place per component.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
