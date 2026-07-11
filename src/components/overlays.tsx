"use client";

import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Overlay policy (plan §2.3):
 *  - Sheet: quick, single-decision UIs (log sheet, steppers, filters, confirms)
 *  - FullScreenModal: immersive multi-step tasks (scanner, workout session,
 *    submission wizards)
 * Both are drag-dismissable and safe-area aware. Anything with a shareable URL
 * stays a route, not an overlay.
 */

type OverlayProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional uncontrolled trigger; rendered with vaul's Trigger asChild. */
  trigger?: React.ReactNode;
  title: string;
  /** Visually hide the title (kept for screen readers). */
  hideTitle?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function Sheet({ open, onOpenChange, trigger, title, hideTitle, children, className }: OverlayProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border-t border-border bg-surface-1 outline-none",
            className
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border-strong" aria-hidden />
          <Drawer.Title className={hideTitle ? "sr-only" : "px-4 pb-1 pt-3 text-base font-bold"}>
            {title}
          </Drawer.Title>
          <div className="min-h-0 overflow-y-auto px-4 pb-6 pt-2 pb-safe">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function FullScreenModal({ open, onOpenChange, trigger, title, hideTitle, children, className }: OverlayProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content
          className={cn("fixed inset-0 z-50 flex h-dvh flex-col bg-bg outline-none", className)}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 pt-safe">
            <Drawer.Title className={hideTitle ? "sr-only" : "text-base font-bold"}>{title}</Drawer.Title>
            <Drawer.Close
              className="rounded-full p-1.5 text-text-secondary transition hover:bg-surface-2 hover:text-text"
              aria-label="Close"
            >
              <X size={20} />
            </Drawer.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto pb-safe">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
