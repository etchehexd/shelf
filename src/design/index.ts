/**
 * The design system's public surface.
 *
 * Nothing in here knows what an anime is. Domain components live in
 * `features/`, and `design/` must never import from them.
 */

export { Button, IconButton, type ButtonProps, type IconButtonProps } from './Button'
export { Card, Well, type CardProps } from './Card'
export { Pill, Chip, type PillProps, type Tone } from './Pill'
export { Stars, type StarsProps } from './Stars'
export { ProgressBar, ProgressStepper, type ProgressBarProps, type ProgressStepperProps } from './Progress'
export { SegmentedControl, type Segment, type SegmentedControlProps } from './SegmentedControl'
export { CoverImage, type CoverImageProps } from './CoverImage'
export { Avatar, type AvatarProps } from './Avatar'
export { Rail, type RailProps } from './Rail'
export { Section, SectionHeader, EmptyState, type SectionHeaderProps, type EmptyStateProps } from './Section'
export { StatTile, BarRow, type StatTileProps, type BarRowProps } from './StatTile'
export { Skeleton, CoverSkeleton, RowSkeleton } from './Skeleton'
export { Popover, MenuItem, MenuSeparator, MenuLabel, type PopoverProps } from './Popover'
export { Dialog, type DialogProps } from './Dialog'
export { Tooltip, type TooltipProps } from './Tooltip'
export { ToastHost, toast, dismissToast, type ToastOptions } from './Toast'
export { Field, Input, Textarea, Switch, type FieldProps } from './Field'

export {
  useMediaQuery,
  usePrefersReducedMotion,
  useEscape,
  useOutsideDismiss,
  useFocusTrap,
  useScrollLock,
  useAnchoredPosition,
  useHoldRepeat,
  type Side,
  type Align,
} from './hooks'

export { useResolvedTheme, applyTheme, systemTheme } from './theme'
