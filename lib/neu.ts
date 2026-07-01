/**
 * Shared class-name tokens for the neumorphic tan/terracotta theme
 * (matches the Claude Design "Dashboard.dc.html" mockup). Centralized here
 * so every page renders the same shadows/colors instead of drifting.
 */

export const RAISED_LG = 'shadow-[8px_8px_18px_#ccb5a5,-8px_-8px_18px_#f7ebe1]'
export const RAISED_LG_HOVER = 'hover:bg-[#e9dacf] hover:shadow-[10px_10px_22px_#c7af9e,-10px_-10px_22px_#faf0e7]'
export const RAISED_SM = 'shadow-[4px_4px_9px_#ccb5a5,-4px_-4px_9px_#f7ebe1]'
export const RAISED_XS = 'shadow-[3px_3px_8px_#ccb5a5,-3px_-3px_8px_#f7ebe1]'
export const RAISED_XS_HOVER = 'hover:shadow-[3px_3px_8px_#ccb5a5,-3px_-3px_8px_#f7ebe1]'
export const INSET_SM = 'shadow-[inset_3px_3px_7px_#ccb5a5,inset_-3px_-3px_7px_#f7ebe1]'
export const INSET_XS = 'shadow-[inset_2px_2px_5px_#ccb5a5,inset_-2px_-2px_5px_#f7ebe1]'

export const CARD = `rounded-[22px] bg-[#e6d6ca] ${RAISED_LG}`
export const CARD_HOVER = `hover:bg-[#e9dacf] hover:shadow-[10px_10px_22px_#c7af9e,-10px_-10px_22px_#faf0e7]`

/** Larger-radius panel used for major single-panel containers (calendar grid, big list panels). */
export const CARD_LG = `rounded-[28px] bg-[#e6d6ca] ${RAISED_LG}`

export const SUBTITLE = 'mt-1.5 text-[15px] font-semibold text-[#a58b78]'

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 border-0 cursor-pointer font-extrabold text-[14px] text-[#faf1e9] bg-[#c1673f] px-5 py-2.5 rounded-2xl shadow-[5px_5px_12px_#b07048,-4px_-4px_10px_#f7ebe1,inset_1px_1px_1px_rgba(255,255,255,0.25)] active:shadow-[inset_3px_3px_7px_#984e2c,inset_-2px_-2px_6px_#cf7550] active:bg-[#b25e38] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'

export const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 border-0 cursor-pointer font-bold text-[14px] text-[#8a7462] bg-[#e6d6ca] px-5 py-2.5 rounded-2xl shadow-[inset_3px_3px_7px_#ccb5a5,inset_-3px_-3px_7px_#f7ebe1] hover:text-[#5a4638] transition-colors whitespace-nowrap'

export const BTN_DANGER_GHOST =
  'inline-flex items-center justify-center gap-2 border-0 cursor-pointer font-bold text-[14px] text-[#b5574a] bg-[#e6d6ca] px-5 py-2.5 rounded-2xl shadow-[inset_3px_3px_7px_#ccb5a5,inset_-3px_-3px_7px_#f7ebe1] hover:text-[#9a4a3f] transition-colors whitespace-nowrap'

export const INPUT =
  'w-full rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#4b3a2f] bg-[#e6d6ca] border-0 outline-none placeholder:text-[#b09a86] placeholder:font-medium shadow-[inset_3px_3px_7px_#ccb5a5,inset_-3px_-3px_7px_#f7ebe1] focus:shadow-[inset_4px_4px_8px_#c7af9e,inset_-4px_-4px_8px_#f7ebe1]'

export const LABEL = 'text-xs font-extrabold uppercase tracking-wide text-[#a58b78] mb-1.5 block'

/** Fixed-size (38px) icon button used for row actions (edit/delete) and modal close
 * buttons — matches the exact sizing found in the Projects.dc.html mockup, replacing
 * the earlier padding-based sizing that drifted from page to page. */
export const ICON_BTN =
  'inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl bg-[#e6d6ca] text-[#8a7462] shadow-[4px_4px_8px_#ccb5a5,-4px_-4px_8px_#f7ebe1] hover:text-[#5a4638] active:shadow-[inset_3px_3px_6px_#ccb5a5,inset_-3px_-3px_6px_#f7ebe1] transition-all'

export const ICON_BTN_DANGER =
  'inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl bg-[#e6d6ca] text-[#bb5a48] shadow-[4px_4px_8px_#ccb5a5,-4px_-4px_8px_#f7ebe1] hover:text-[#9a4a3f] active:shadow-[inset_3px_3px_6px_#ccb5a5,inset_-3px_-3px_6px_#f7ebe1] transition-all'

/** Grouped filter/tab chips — one inset-shadow "track" holding plain-text buttons,
 * where the active chip pops up as a small raised pill inside it. Matches
 * Projects.dc.html; replaces the earlier pattern of separately-shadowed pills. */
export const CHIP_GROUP = 'flex gap-2 p-1.5 rounded-2xl bg-[#e6d6ca] shadow-[inset_3px_3px_7px_#ccb5a5,inset_-3px_-3px_7px_#f7ebe1] self-start flex-wrap'
export const CHIP_ACTIVE = 'border-0 cursor-pointer font-extrabold text-[13.5px] px-4 py-2 rounded-xl transition-shadow capitalize whitespace-nowrap text-[#c1673f] bg-[#e6d6ca] shadow-[4px_4px_9px_#ccb5a5,-4px_-4px_9px_#f7ebe1]'
export const CHIP_INACTIVE = 'border-0 cursor-pointer font-bold text-[13.5px] px-4 py-2 rounded-xl transition-shadow capitalize whitespace-nowrap text-[#9a8571] bg-transparent'

export function chipClass(active: boolean) {
  return active ? CHIP_ACTIVE : CHIP_INACTIVE
}

/** Solid light-background chip (status/priority/category tags) — matches
 * Projects.dc.html; replaces the earlier beige-inset-shadow `BADGE` style. */
export const SOLID_CHIP = 'inline-flex items-center gap-1 text-[11.5px] font-extrabold px-2.5 py-1 rounded-full capitalize'

export type ChipMeta = { bg: string; tx: string }

/** Semantic bg/text pairs used for severity-style chips (priority, warranty status, etc). */
export const SEVERITY_META: Record<'danger' | 'warning' | 'success' | 'neutral' | 'info', ChipMeta> = {
  danger: { bg: '#efd9cf', tx: '#bb5a48' },
  warning: { bg: '#eee0c7', tx: '#a37a2f' },
  success: { bg: '#e2e5cf', tx: '#6d8a52' },
  neutral: { bg: '#e7ddce', tx: '#7a6142' },
  info: { bg: '#dfe6ea', tx: '#4d6b78' },
}

export const PRIORITY_META: Record<'low' | 'medium' | 'high', ChipMeta> = {
  high: SEVERITY_META.danger,
  medium: SEVERITY_META.warning,
  low: SEVERITY_META.success,
}

const QUALITATIVE_CHIPS: ChipMeta[] = [
  SEVERITY_META.neutral,
  { bg: '#efd9cf', tx: '#a24e30' },
  { bg: '#e2e5cf', tx: '#556f38' },
  { bg: '#eee0c7', tx: '#8f6a1f' },
  { bg: '#ecd9df', tx: '#96475a' },
  { bg: '#dfe6ea', tx: '#3f6a78' },
  { bg: '#e5dcef', tx: '#6b4e8f' },
]

/** Deterministically picks a bg/tx pair for an arbitrary label (contact/inventory
 * category, etc.) from the shared qualitative palette, so the same label always
 * renders the same color without needing a hand-authored map per page. */
export function qualitativeChip(seed: string | null | undefined): ChipMeta {
  if (!seed) return SEVERITY_META.neutral
  const idx = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % QUALITATIVE_CHIPS.length
  return QUALITATIVE_CHIPS[idx]
}

export const MODAL_OVERLAY = 'fixed inset-0 bg-[#4b3a2f]/40 flex items-center justify-center z-50 p-4'
export const MODAL_PANEL = 'w-full rounded-[28px] bg-[#e6d6ca] p-6 shadow-[14px_14px_30px_#c7af9e,-10px_-10px_26px_#faf0e7] max-h-[90vh] overflow-y-auto'

/** Muted, desaturated hex palette that reads well on the #e6d6ca background — used to
 * recolor arbitrary user-chosen tags (priority, status, category, event color, etc.)
 * that used to map to saturated Tailwind palette colors. */
export const HEX_PALETTE: Record<string, string> = {
  gray: '#a58b78',
  blue: '#7d93a0',
  green: '#7c9a6e',
  red: '#b5574a',
  purple: '#957a9e',
  orange: '#c47a3d',
  pink: '#bd6b6f',
  teal: '#6e9a92',
  yellow: '#bd9038',
}

export function hexFor(name: string | null | undefined): string {
  if (!name) return HEX_PALETTE.gray
  return HEX_PALETTE[name] ?? HEX_PALETTE.gray
}
