import type { Transition } from "motion/react";

/*
 * Motion vocabulary (plan §3.4). Use these constants instead of ad-hoc values
 * so the whole app moves with one voice:
 *  - micro: taps, toggles, chips, icon state
 *  - sheet: bottom sheets / full-screen modals
 *  - celebrate: PR, streak milestone, goal hit — the ONLY bouncy spring
 */
export const MICRO: Transition = { duration: 0.15, ease: "easeOut" };
export const SHEET: Transition = { type: "spring", stiffness: 400, damping: 34 };
export const CELEBRATE: Transition = { type: "spring", stiffness: 500, damping: 18 };
export const PAGE: Transition = { duration: 0.2, ease: "easeOut" };

/** Ring/chart draw-in on mount. */
export const DRAW: Transition = { duration: 0.6, ease: "easeOut" };
