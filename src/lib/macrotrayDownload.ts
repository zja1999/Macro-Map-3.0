export const MACROTRAY_DISMISS_MS = 30 * 24 * 60 * 60_000;

export function canOfferMacroTrayDownload(input: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  dismissedAt: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const windows = /Windows NT/i.test(input.userAgent);
  const mobile = /Android|Mobile|Tablet|iPad|iPhone/i.test(input.userAgent) || input.maxTouchPoints > 2;
  const wrapped = /MacroVerseApp|MacroTray\//i.test(input.userAgent);
  return windows && !mobile && !wrapped && !input.standalone && now - input.dismissedAt > MACROTRAY_DISMISS_MS;
}
