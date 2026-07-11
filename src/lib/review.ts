import { isNative } from "@/lib/native";

/**
 * In-app store-review nudge (overhaul plan Phase 4 §3d). Asks the OS to show its
 * native "rate this app" dialog after a genuinely positive moment (a streak
 * milestone or a workout PR), and never nags:
 *   - each distinct moment is counted at most once (dedupe by key, across restarts),
 *   - it takes a couple of good moments before we ever ask,
 *   - and at least MIN_DAYS_BETWEEN days must pass between prompts.
 * On top of that, Google/Apple themselves quota how often the dialog actually renders,
 * so this can only ever under-ask. No-op on web or when the plugin isn't in the build.
 */

const KEY = "mm.review.v1";
const MIN_DAYS_BETWEEN = 90;
const MOMENTS_BEFORE_ASK = 2;

type State = { lastPromptedAt?: number; goodMoments: number; lastMoment?: string };

function read(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { goodMoments: 0, ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    /* corrupt/unavailable storage — start fresh */
  }
  return { goodMoments: 0 };
}

function write(s: State): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota — the nudge is optional, so drop it */
  }
}

export async function maybeRequestReview(momentKey: string): Promise<void> {
  if (!isNative() || typeof localStorage === "undefined") return;

  const s = read();
  if (s.lastMoment === momentKey) return; // already counted this exact moment
  s.lastMoment = momentKey;
  s.goodMoments = (s.goodMoments ?? 0) + 1;

  const now = Date.now();
  const cooledDown = !s.lastPromptedAt || now - s.lastPromptedAt > MIN_DAYS_BETWEEN * 86400_000;
  if (s.goodMoments < MOMENTS_BEFORE_ASK || !cooledDown) {
    write(s);
    return;
  }

  try {
    const { InAppReview } = await import("@capacitor-community/in-app-review");
    await InAppReview.requestReview();
    write({ lastPromptedAt: now, goodMoments: 0, lastMoment: momentKey });
  } catch {
    write(s); // plugin absent / failed — keep the momentum, try again next time
  }
}
