/**
 * The design system's public surface.
 *
 * Nothing in here knows what an anime is. Domain components live in
 * `features/`, and `design/` must never import from them.
 */

export { Button, IconButton, buttonClasses, type ButtonProps, type IconButtonProps } from './Button'
export { Card, Well, ShelfLine, Rule, type CardProps } from './Card'
export { Pill, Chip, type PillProps, type Tone } from './Pill'
export { GenrePill, type GenrePillProps } from './GenrePill'
export {
  Rating,
  RatingInput,
  CommunityScore,
  ratingWord,
  scoreBand,
  communityOutOfTen,
  communityText,
  RATING_MAX,
  RATING_WORD,
  SCORE_BAND_WORD,
  type RatingProps,
  type RatingInputProps,
  type CommunityScoreProps,
  type ScoreBand,
} from './Rating'
export { ScoreHistogram, type ScoreHistogramProps } from './ScoreHistogram'
export { ProgressBar, ProgressStepper, type ProgressBarProps, type ProgressStepperProps } from './Progress'
export { SegmentedControl, type Segment, type SegmentedControlProps } from './SegmentedControl'
export { CoverImage, CoverStack, type CoverImageProps, type CoverStackProps } from './CoverImage'
export { Avatar, type AvatarProps } from './Avatar'
export { Rail, type RailProps } from './Rail'
export {
  ShelfRail,
  LeanRow,
  ArtBand,
  type ShelfRailProps,
  type LeanRowProps,
  type ArtBandProps,
} from './Shelf'
export {
  Section,
  SectionHeader,
  Eyebrow,
  EmptyState,
  type SectionHeaderProps,
  type EmptyStateProps,
} from './Section'
export { StatTile, BarRow, type StatTileProps, type BarRowProps } from './StatTile'
export { Skeleton, CoverSkeleton, RowSkeleton } from './Skeleton'
export {
  Popover,
  ContextMenu,
  useContextMenu,
  MenuItem,
  MenuSeparator,
  MenuLabel,
  type PopoverProps,
  type ContextPoint,
} from './Popover'
export { Dialog, type DialogProps } from './Dialog'
export { Tooltip, type TooltipProps } from './Tooltip'
export { ToastHost, toast, dismissToast, type ToastOptions } from './Toast'
export { Field, Input, SearchInput, Textarea, Switch, type FieldProps } from './Field'

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

export {
  useResolvedTheme,
  applyTheme,
  paintAccent,
  customAccent,
  systemTheme,
  PALETTES,
  CUSTOM_HUE_DEFAULT,
  type PaletteId,
} from './theme'

export { ImagePicker, type ImagePickerProps } from './ImagePicker'
export { useReveal } from './reveal'
export { usePageAccent } from './pageAccent'
