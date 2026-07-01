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

export const ICON_BTN =
  'inline-flex items-center justify-center p-2 rounded-xl bg-[#e6d6ca] text-[#8a7462] shadow-[4px_4px_9px_#ccb5a5,-4px_-4px_9px_#f7ebe1] hover:text-[#5a4638] active:shadow-[inset_2px_2px_5px_#ccb5a5,inset_-2px_-2px_5px_#f7ebe1] transition-all'

export const ICON_BTN_DANGER =
  'inline-flex items-center justify-center p-2 rounded-xl bg-[#e6d6ca] text-[#b5574a] shadow-[4px_4px_9px_#ccb5a5,-4px_-4px_9px_#f7ebe1] hover:text-[#9a4a3f] active:shadow-[inset_2px_2px_5px_#ccb5a5,inset_-2px_-2px_5px_#f7ebe1] transition-all'

export const PILL_ACTIVE = 'px-4 py-2 rounded-full text-[13px] font-extrabold text-[#faf1e9] bg-[#c1673f] shadow-[3px_3px_8px_#ccb5a5,-2px_-2px_6px_#f7ebe1] capitalize whitespace-nowrap'
export const PILL_INACTIVE = 'px-4 py-2 rounded-full text-[13px] font-bold text-[#8a7462] bg-[#e6d6ca] shadow-[inset_2px_2px_5px_#ccb5a5,inset_-2px_-2px_5px_#f7ebe1] hover:text-[#5a4638] capitalize whitespace-nowrap transition-colors'

export function pillClass(active: boolean) {
  return active ? PILL_ACTIVE : PILL_INACTIVE
}

export const BADGE =
  'inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#e6d6ca] shadow-[inset_2px_2px_5px_#ccb5a5,inset_-2px_-2px_5px_#f7ebe1] capitalize'

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
