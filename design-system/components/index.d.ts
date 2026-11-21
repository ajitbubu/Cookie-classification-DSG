import type * as React from "react"

// ---- core/Avatar
/** Circular identity chip; used in the app header and in `UserPill`. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 24px (`sm`) · 32px (`default`) · 40px (`lg`). */
  size?: "default" | "sm" | "lg"
  children?: React.ReactNode
}

export declare function Avatar(props: AvatarProps): React.JSX.Element
export declare function AvatarImage(props: React.ImgHTMLAttributes<HTMLImageElement>): React.JSX.Element
export declare function AvatarFallback(props: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element
export declare function AvatarBadge(props: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element
export declare function AvatarGroup(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function AvatarGroupCount(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element

// ---- core/Badge
export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "accent"
  | "outline"
  | "ghost"
  | "link"

/** Small status pill used for consent expiry state, PIA stage, DSR status. */
export interface BadgeProps extends React.HTMLAttributes<HTMLElement> {
  variant?: BadgeVariant
  /** Rendered tag; defaults to `span`. */
  as?: keyof JSX.IntrinsicElements
  children?: React.ReactNode
}

export declare function Badge(props: BadgeProps): React.JSX.Element

// ---- core/Button
export type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"

export type ButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "xl"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg"

/**
 * The portal's action button.
 *
 */
export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  /** Visual treatment. `default` = brand-blue fill. */
  variant?: ButtonVariant
  /** Height/padding preset. `icon*` sizes render a square. */
  size?: ButtonSize
  /** Override the rendered tag (defaults to `button`, or `a` when `href` is set). */
  as?: keyof JSX.IntrinsicElements
  href?: string
  disabled?: boolean
  type?: "button" | "submit" | "reset"
  children?: React.ReactNode
}

export declare function Button(props: ButtonProps): React.JSX.Element

// ---- core/Card
/**
 * The portal's base surface — white, 24px radius, 1px `foreground/5` ring,
 * `--shadow-sm`. Interior padding comes from `--card-spacing` (20px, or 16px
 * at `size="sm"`), which every sub-part reads.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `sm` tightens `--card-spacing` from 20px to 16px. */
  size?: "default" | "sm"
  children?: React.ReactNode
}

export declare function Card(props: CardProps): React.JSX.Element
export declare function CardHeader(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function CardTitle(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function CardDescription(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function CardContent(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function CardFooter(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element

// ---- core/Label
/** Form label — 14px, weight 500, `-0.08px` tracking. */
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Prefixes a red asterisk. */
  required?: boolean
  /** Leading 16px glyph (auth fields use Mail / KeyRound / RefreshCw). */
  icon?: React.ReactNode
  children?: React.ReactNode
}

export declare function Label(props: LabelProps): React.JSX.Element

// ---- core/Separator
export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

export declare function Separator(props: SeparatorProps): React.JSX.Element

// ---- core/Skeleton
/** Muted block with a 1.6s left-to-right shimmer sweep. */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export declare function Skeleton(props: SkeletonProps): React.JSX.Element

// ---- data/CountryPill
/** Country table cell — a `secondary` Badge with a leading globe glyph. */
export interface CountryPillProps extends React.HTMLAttributes<HTMLElement> {
  country: string
}

export declare function CountryPill(props: CountryPillProps): React.JSX.Element

// ---- data/DataTable
/** Passed to every column `cell` and to `renderExpandedRow`. */
export interface DataTableRowContext {
  rowKey: string
  index: number
  isExpanded: boolean
  toggleExpand: () => void
}

export interface DataTableColumn<TRow = any> {
  id: string
  header: React.ReactNode
  headerClassName?: string
  cellClassName?: string | ((row: TRow, ctx: DataTableRowContext) => string | undefined)
  cell: (row: TRow, ctx: DataTableRowContext) => React.ReactNode
}

/**
 * The listing table every PMP screen is built on — consent, DSR, PIA.
 *
 * @startingPoint section="Data" subtitle="Column-driven listing table with expandable rows" viewport="700x260"
 */
export interface DataTableProps<TRow = any> {
  columns: DataTableColumn<TRow>[]
  /** Rows for the CURRENT view — filter/sort/paginate before passing. */
  rows: TRow[]
  getRowKey?: (row: TRow, index: number) => string
  containerClassName?: string
  headerClassName?: string
  headerRowClassName?: string
  rowClassName?: (row: TRow, ctx: DataTableRowContext) => string | undefined
  /** Row expansion is opt-in as a group — omit all three for a plain table. */
  isRowExpanded?: (row: TRow, rowKey: string) => boolean
  onToggleExpand?: (rowKey: string) => void
  renderExpandedRow?: (row: TRow, ctx: DataTableRowContext) => React.ReactNode
  expandedRowClassName?: string
  expandedCellClassName?: string
  emptyState?: React.ReactNode
}

export declare function DataTable<TRow = any>(props: DataTableProps<TRow>): React.JSX.Element

// ---- data/DataTableActions
/** Filter + Export + view-options, in the order the product's toolbars use. */
export interface DataTableActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Each handler is optional — omit one and that button isn't rendered. */
  onFilter?: () => void
  onExport?: () => void
  onViewOptions?: () => void
  /** Active-filter count badge on the filter button. */
  filterCount?: number
}

export declare function DataTableActions(props: DataTableActionsProps): React.JSX.Element

/** Icon-only view/column options trigger (42×38). */
export declare function DataTableViewOptionsButton(props: ButtonProps): React.JSX.Element

/** Export trigger with a leading upload arrow. */
export declare function DataTableExportButton(props: ButtonProps): React.JSX.Element

/** Filter trigger; `count` renders a brand-blue active-filter badge. */
export declare function DataTableFilterButton(props: ButtonProps & { count?: number }): React.JSX.Element

// ---- data/DataTablePagination
/** Visible strings, overridable so the app can pass localized text. */
export interface DataTablePaginationLabels {
  showing?: string
  of?: string
  rows?: string
}

/** Range text + rows-per-page select and a 5-button numbered pager. */
export interface DataTablePaginationProps {
  from: number
  to: number
  total: number
  page: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  /** Defaults to `[10, 20, 50]`. */
  pageSizeOptions?: number[]
  labels?: DataTablePaginationLabels
}

export declare function DataTablePagination(props: DataTablePaginationProps): React.JSX.Element

// ---- data/DataTableToolbar
/** The row above a `DataTable`: search on the left, filters/actions on the right. */
export interface DataTableToolbarProps {
  showSearch?: boolean
  searchValue?: string
  onSearchChange?: (value: string) => void
  /** Passthrough props for the underlying `SearchField`. */
  searchProps?: Record<string, unknown>
  filterSlot?: React.ReactNode
  actionsSlot?: React.ReactNode
  className?: string
}

export declare function DataTableToolbar(props: DataTableToolbarProps): React.JSX.Element

// ---- data/ExpandableText
/**
 * Clips text to `maxLines` and offers a "more" toggle **only when the
 * content actually overflows** — measured from the DOM, not guessed.
 */
export interface ExpandableTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Pre-sanitized HTML (the product runs DOMPurify before passing it). */
  html?: string
  children?: React.ReactNode
  maxLines?: number
  moreLabel?: string
  lessLabel?: string
  /** `stacked` puts the toggle on its own line — use in narrow grid cells. */
  layout?: "inline" | "stacked"
  /** Classes for the text itself, not the toggle. */
  textClassName?: string
}

export declare function ExpandableText(props: ExpandableTextProps): React.JSX.Element

// ---- data/SidebarList
export interface SidebarListRenderContext {
  isSelected: boolean
}

/**
 * Searchable master list inside a card — the consent group picker on the left
 * of the consent screen. Fixed 782px tall / 20rem wide on desktop so it lines
 * up with the detail pane.
 *
 * @startingPoint section="Data" subtitle="Searchable master list card" viewport="700x300"
 */
export interface SidebarListProps<TItem = any> {
  items: TItem[]
  getItemId?: (item: TItem) => string
  selectedId?: string
  onSelect?: (id: string) => void
  /** Full inner content of the item button. */
  renderItem: (item: TItem, ctx: SidebarListRenderContext) => React.ReactNode
  itemClassName?: (item: TItem, ctx: SidebarListRenderContext) => string | undefined
  title?: React.ReactNode
  isLoading?: boolean
  loadingItemCount?: number
  showSearch?: boolean
  searchAriaLabel?: string
  searchPlaceholder?: string
  /** Text the search query matches against; omit to disable filtering. */
  getSearchText?: (item: TItem) => string
  emptyMessage?: React.ReactNode
  className?: string
  listClassName?: string
}

export declare function SidebarList<TItem = any>(props: SidebarListProps<TItem>): React.JSX.Element

// ---- data/StatCard
/**
 * Decorative KPI accents from the DSG reference design — a fixed four-colour
 * category convention (info / success / warning / other), NOT brand-hue
 * scaled, so every client theme defines them independently.
 */
export type StatCardTone = "blue" | "sky" | "green" | "amber" | "violet" | "red"

/**
 * The KPI tile above every listing screen.
 *
 */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  value: React.ReactNode
  /** Rendered next to the value, as-is. */
  hint?: React.ReactNode
  /** 20px glyph (a Lucide icon element). */
  icon?: React.ReactNode
  tone?: StatCardTone
  /** Escape hatch for a background the tone set doesn't cover. */
  iconStyle?: React.CSSProperties
  /** Top-right slot, e.g. a trend badge. */
  topRight?: React.ReactNode
}

export declare function StatCard(props: StatCardProps): React.JSX.Element

// ---- data/Table
/** Styled `<table>` in a horizontal-scroll container. */
export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Classes for the scroll wrapper (height/overflow). */
  containerClassName?: string
}

export declare function Table(props: TableProps): React.JSX.Element
export declare function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element
export declare function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element
export declare function TableFooter(props: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element
export declare function TableRow(props: React.HTMLAttributes<HTMLTableRowElement>): React.JSX.Element
export declare function TableHead(props: React.ThHTMLAttributes<HTMLTableCellElement>): React.JSX.Element
export declare function TableCell(props: React.TdHTMLAttributes<HTMLTableCellElement>): React.JSX.Element
export declare function TableCaption(props: React.HTMLAttributes<HTMLTableCaptionElement>): React.JSX.Element

// ---- data/UserPill
/** Person table cell — 24px brand-blue initials avatar plus the full name. */
export interface UserPillProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
}

export declare function UserPill(props: UserPillProps): React.JSX.Element

// ---- feedback/Dialog
/** Centred modal with a blurred `black/30` scrim. */
export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  showCloseButton?: boolean
  onClose?: () => void
  /** Pass a translated string; the package default is English. */
  closeButtonLabel?: string
}

export declare function Dialog(props: DialogProps): React.JSX.Element | null
export declare function DialogContent(props: DialogContentProps): React.JSX.Element
export declare function DialogHeader(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function DialogTitle(props: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element
export declare function DialogDescription(props: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element
export declare function DialogFooter(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element

// ---- feedback/Drawer
/** Sheet panel — the audit-log and preference-history surface. */
export interface DrawerProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** `down` = bottom sheet (phones); `right` = 24rem side panel (desktop). */
  side?: "down" | "right"
  modal?: boolean
  /** Shows the grab bar; only meaningful on the bottom sheet. */
  showSwipeHandle?: boolean
}

export declare function Drawer(props: DrawerProps): React.JSX.Element | null
export declare function DrawerHeader(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function DrawerTitle(props: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element
export declare function DrawerDescription(props: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element
export declare function DrawerBody(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function DrawerFooter(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element

// ---- feedback/DropdownMenu
/** Action menu — the header account menu, table row actions, language picker. */
export interface DropdownMenuProps extends React.HTMLAttributes<HTMLSpanElement> {
  trigger?: React.ReactNode
  align?: "start" | "end"
  children?: React.ReactNode
}

export declare function DropdownMenu(props: DropdownMenuProps): React.JSX.Element
export declare function DropdownMenuItem(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "destructive" }): React.JSX.Element
export declare function DropdownMenuLabel(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function DropdownMenuSeparator(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function DropdownMenuShortcut(props: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element

// ---- feedback/Popover
/** Anchored panel — filter forms, column pickers. 288px min width, 16px padding. */
export interface PopoverProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Omit for uncontrolled open/close. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** The clickable element that toggles the panel. */
  trigger?: React.ReactNode
  align?: "start" | "end"
  children?: React.ReactNode
}

export declare function Popover(props: PopoverProps): React.JSX.Element
export declare function PopoverTitle(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function PopoverDescription(props: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element

// ---- feedback/SuccessToast
/** The two-line success toast (title + description + 48px icon tile). */
export interface SuccessToastProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  onDismiss?: () => void
}

export declare function SuccessToast(props: SuccessToastProps): React.JSX.Element

// ---- feedback/Tooltip
/** Hover/focus label — dark bubble, 12px text, no delay. */
export interface TooltipProps extends React.HTMLAttributes<HTMLSpanElement> {
  content: React.ReactNode
  side?: "top" | "bottom"
  children?: React.ReactNode
}

export declare function Tooltip(props: TooltipProps): React.JSX.Element

// ---- forms/Calendar
/** Single-month day grid; the popup content of `DatePickerField`. */
export interface CalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: Date
  onSelect?: (date: Date) => void
  /** Month shown on first render when nothing is selected. */
  defaultMonth?: Date
}

export declare function Calendar(props: CalendarProps): React.JSX.Element

// ---- forms/Checkbox
/** 16px checkbox — `2.5px` radius, `#767676` unchecked border, brand fill when checked. */
export interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean
  /** Renders the mixed (dash) indicator and reports `aria-checked="mixed"`. */
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export declare function Checkbox(props: CheckboxProps): React.JSX.Element

// ---- forms/Combobox
/**
 * Searchable dropdown whose value is free text — the dropdown is a
 * convenience, not a constraint. Use for countries, states, cities, tags.
 */
export interface ComboboxProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
  options?: string[]
  placeholder?: string
  /** Shown when nothing matches; the default invites a custom value. */
  emptyText?: string
  disabled?: boolean
}

export declare function Combobox(props: ComboboxProps): React.JSX.Element

// ---- forms/DatePickerField
/**
 * Labelled date field. Never use a native `<input type="date">` in this
 * product — its segment order follows the OS locale. The stored value is an
 * ISO `yyyy-MM-dd` string; the display format is the app's choice.
 */
export interface DatePickerFieldProps {
  id: string
  label?: React.ReactNode
  required?: boolean
  /** ISO date (`yyyy-MM-dd`), or `""` when unset. */
  value?: string
  onValueChange?: (value: string) => void
  error?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export declare function DatePickerField(props: DatePickerFieldProps): React.JSX.Element

// ---- forms/Field
/**
 * Layout primitive for a form row. `vertical` stacks label over control
 * (the default everywhere in the DSR form); `horizontal` puts a checkbox or
 * radio before its label.
 */
export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal"
  invalid?: boolean
  children?: React.ReactNode
}

export declare function Field(props: FieldProps): React.JSX.Element
export declare function FieldSet(props: React.FieldsetHTMLAttributes<HTMLFieldSetElement>): React.JSX.Element
export declare function FieldLegend(props: React.HTMLAttributes<HTMLLegendElement> & { variant?: "legend" | "label" }): React.JSX.Element
export declare function FieldGroup(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function FieldContent(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function FieldTitle(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function FieldDescription(props: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element
export declare function FieldError(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element

// ---- forms/Input
/** Single-line text field — 40px tall, `--radius-lg`, 13px side padding. */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export declare function Input(props: InputProps): React.JSX.Element

// ---- forms/InputOTP
/** Digit-slot OTP entry used by the login and registration verify steps. */
export interface InputOTPProps {
  value: string
  onChange: (value: string) => void
  /** Slot count; the portal always uses 6. */
  length?: number
  onComplete?: (value: string) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

export declare function InputOTP(props: InputOTPProps): React.JSX.Element

// ---- forms/RadioGroup
/** Single-choice set — DSR request type, "I am raising for/as", PII element. */
export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

export interface RadioGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean
  onSelect?: () => void
  disabled?: boolean
}

export declare function RadioGroup(props: RadioGroupProps): React.JSX.Element
export declare function RadioGroupItem(props: RadioGroupItemProps): React.JSX.Element

// ---- forms/SearchField
/** `Input` with a leading Lucide `search` glyph; children render as a trailing action. */
export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Classes for the wrapper (use `inputClassName` for the field itself). */
  className?: string
  inputClassName?: string
  children?: React.ReactNode
}

export declare function SearchField(props: SearchFieldProps): React.JSX.Element

// ---- forms/Select
export interface SelectOption {
  value: string
  label?: React.ReactNode
}

/**
 * Closed-list dropdown. Default is the compact 32px toolbar form (tinted,
 * borderless); `size="lg"` gives the 40px bordered form used inside forms.
 */
export interface SelectProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
  /** Plain strings or `{ value, label }` objects. */
  options?: Array<string | SelectOption>
  placeholder?: string
  size?: "sm" | "default" | "lg"
  disabled?: boolean
}

export declare function Select(props: SelectProps): React.JSX.Element
export declare function SelectLabel(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function SelectSeparator(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element

// ---- forms/Switch
/**
 * The opt-in/opt-out toggle — the single most important control in the
 * portal. Track is 32×18.4px (`size="sm"`: 24×14px).
 *
 */
export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  size?: "default" | "sm"
}

export declare function Switch(props: SwitchProps): React.JSX.Element

// ---- forms/Textarea
/** Multi-line field on a tinted (`input/50`) surface with no visible border. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export declare function Textarea(props: TextareaProps): React.JSX.Element

// ---- forms/Toggle
/** Pressable state button; the pressed fill is `--muted`. */
export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
}

/** Row (or column) of `Toggle`s. `spacing={0}` fuses them into a segmented control. */
export interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  spacing?: 0 | 2
  orientation?: "horizontal" | "vertical"
}

export declare function Toggle(props: ToggleProps): React.JSX.Element
export declare function ToggleGroup(props: ToggleGroupProps): React.JSX.Element

// ---- navigation/BottomNav
/** Mobile primary navigation bar on the fixed dark-navy surface. */
export interface BottomNavProps extends React.HTMLAttributes<HTMLElement> {}

export interface BottomNavItemProps extends React.HTMLAttributes<HTMLElement> {
  active?: boolean
  as?: keyof JSX.IntrinsicElements
  href?: string
}

export declare function BottomNav(props: BottomNavProps): React.JSX.Element
export declare function BottomNavItem(props: BottomNavItemProps): React.JSX.Element
export declare function BottomNavLabel(props: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element

// ---- navigation/Header
/**
 * The app bar. A rounded, bordered card at ≥768px; a flat bottom-bordered
 * bar on phones.
 *
 */
export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Page heading block — the product pushes each page's own title up here. */
  title?: React.ReactNode
  /** Right-hand actions: notifications bell, account menu. */
  children?: React.ReactNode
}

export declare function Header(props: HeaderProps): React.JSX.Element

// ---- navigation/PageHeader
/** Mobile drill-down header — back button + title, sticky, 56px tall. */
export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {}

export declare function PageHeader(props: PageHeaderProps): React.JSX.Element
export declare function PageHeaderBackButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element
export declare function PageHeaderTitle(props: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element
export declare function PageHeaderActions(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element

// ---- navigation/Sidebar
export interface SidebarNavItem {
  key: string
  label: string
  href: string
  /** 24px glyph element. */
  icon: React.ReactNode
  active?: boolean
  /** Greyed-out and non-clickable, e.g. gated behind an incomplete profile. */
  disabled?: boolean
}

/**
 * The portal's primary desktop navigation — a fixed 108px dark-navy rail.
 *
 * @startingPoint section="Navigation" subtitle="108px dark navy app rail" viewport="700x400"
 */
export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  items: SidebarNavItem[]
  /** Brand mark, ~36px tall. */
  logo?: React.ReactNode
  /** Bottom block — the product shows the product name and "V 3.0". */
  footer?: React.ReactNode
}

export declare function Sidebar(props: SidebarProps): React.JSX.Element

// ---- navigation/Tabs
/** `pill` is the consent-category filter row; `default` and `line` are the generic sets. */
export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "line" | "pill"
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  onSelect?: () => void
}

export declare function Tabs(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element
export declare function TabsList(props: TabsListProps): React.JSX.Element
export declare function TabsTrigger(props: TabsTriggerProps): React.JSX.Element
export declare function TabsContent(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element

// ---- pmp/BrandLockup
/**
 * The auth-screen brand hero. Poppins, white on the `--auth-hero-from` →
 * `--auth-hero-to` gradient.
 *
 */
export interface BrandLockupProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "default" | "sm"
  /** Path to `assets/brand/brainLogo.png`. */
  image?: string
  tagline?: string
}

export declare function BrandLockup(props: BrandLockupProps): React.JSX.Element

// ---- pmp/EmptyState
/** The portal's empty/no-results block. */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 24px glyph inside the round muted tile. Ignored when `illustration` is set. */
  icon?: React.ReactNode
  /** Path to `assets/illustrations/empty-graphics.png` for the richer variant. */
  illustration?: string
  title: React.ReactNode
  description?: React.ReactNode
  /** Usually an `outline` Button — "Clear Filters". */
  action?: React.ReactNode
}

export declare function EmptyState(props: EmptyStateProps): React.JSX.Element

// ---- pmp/GuardianPendingChip
/** Shown in the Status column while `guardian_approval_status === "Pending"`. */
export interface GuardianPendingChipProps extends React.HTMLAttributes<HTMLElement> {
  label?: string
}

export declare function GuardianPendingChip(props: GuardianPendingChipProps): React.JSX.Element

// ---- pmp/MandatoryChip
/**
 * Marks a non-optional (`is_optional: false`) consent or preference **in
 * place of** a disabled toggle — the portal never shows a greyed-out switch.
 */
export interface MandatoryChipProps extends React.HTMLAttributes<HTMLElement> {
  /** Pass a translated string; defaults to "Mandatory". */
  label?: string
}

export declare function MandatoryChip(props: MandatoryChipProps): React.JSX.Element

// ---- pmp/PendingChangesBar
/**
 * The staged-changes bar. Flipping a consent `Switch` does not save — it
 * stages, and this bar commits the batch through one notes-confirm dialog.
 * Fixed to the bottom of the screen on phones, in flow on desktop.
 */
export interface PendingChangesBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Consent group name, interpolated into the note. */
  listName: string
  onReset: () => void
  onApply: () => void
  disabled?: boolean
  /** Seconds left in the post-save cooldown; 0 means none. */
  resaveCooldown?: number
}

export declare function PendingChangesBar(props: PendingChangesBarProps): React.JSX.Element

// ---- pmp/PreferenceCard
/**
 * One preference channel (email, SMS, WhatsApp, push…). Padding is the
 * literal design value `15.8px 23.8px`.
 *
 */
export interface PreferenceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: React.ReactNode
  subtitle?: React.ReactNode
  active?: boolean
  /** `default` variant only: renders `MandatoryChip` instead of a toggle. */
  mandatory?: boolean
  /**
   * `consent` (inside an expanded consent row) titles the card from the
   * purpose, footers with the expiry date and shows a live toggle.
   * `default` (Preference page) titles from the channel and footers with
   * "Last updated".
   */
  variant?: "consent" | "default"
  footer?: React.ReactNode
  onToggle?: (checked: boolean) => void
  onHistoryClick?: () => void
  toggleDisabled?: boolean
}

export declare function PreferenceCard(props: PreferenceCardProps): React.JSX.Element
