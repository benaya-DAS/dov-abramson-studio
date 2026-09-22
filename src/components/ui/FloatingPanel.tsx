"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type FloatingAlign = "start" | "end";

/**
 * Renders `children` into document.body via a portal, positioned with
 * `position: fixed` against `anchorRef`'s current on-screen location.
 *
 * This is what makes a dropdown/popover immune to any ancestor's
 * `overflow-x-auto`/`overflow-hidden`/stacking context (a scrollable table
 * wrapper, a card, etc.) — it isn't a DOM descendant of that ancestor at
 * all, so there's nothing for it to clip against. `position: fixed` (not
 * `absolute`) matters just as much as the portal: an absolutely positioned
 * element still resolves against its nearest positioned ancestor and can
 * still be clipped by an overflow:hidden/auto one in between, portal or
 * not; fixed positioning resolves against the viewport itself.
 *
 * Flips above the anchor when there isn't room below, and clamps
 * horizontally so it never runs off either edge of the viewport.
 */
export default function FloatingPanel({
  anchorRef,
  align = "start",
  gap = 6,
  className,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: FloatingAlign;
  gap?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    top: -9999,
    left: -9999,
    visibility: "hidden",
  });
  // Lazy-initialized once, synchronously, instead of flipped true in a
  // later effect: every call site only ever mounts this component after a
  // real client-side click, so document.body already exists the very
  // first time this runs — there's no SSR pass to guard against here, and
  // deferring "mounted" to an effect previously meant the portal (and
  // panelRef) didn't exist yet on the render where the position effect
  // below ran, leaving the panel stuck permanently invisible.
  const [mounted] = useState(() => typeof document !== "undefined");

  useLayoutEffect(() => {
    function positionAt(anchor: HTMLElement, panel: HTMLDivElement) {
      const anchorRect = anchor.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const viewportW = document.documentElement.clientWidth;
      const viewportH = document.documentElement.clientHeight;

      const spaceBelow = viewportH - anchorRect.bottom;
      const spaceAbove = anchorRect.top;
      const openUpward = spaceBelow < panelRect.height + gap && spaceAbove > spaceBelow;
      const top = openUpward
        ? Math.max(8, anchorRect.top - gap - panelRect.height)
        : anchorRect.bottom + gap;

      let left = align === "end" ? anchorRect.right - panelRect.width : anchorRect.left;
      left = Math.min(Math.max(8, left), viewportW - panelRect.width - 8);

      setStyle({ position: "fixed", top, left, visibility: "visible" });
    }

    function update() {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (anchor && panel) positionAt(anchor, panel);
    }

    // The refs can legitimately still be null on the very first paint in
    // edge cases (e.g. the anchor itself mounts in the same commit as this
    // panel). Retry a few times via rAF rather than leaving the panel
    // stuck invisible if that happens, instead of assuming both refs are
    // already attached by the time this effect body runs.
    let cancelled = false;
    function updateWithRetry(attemptsLeft = 5) {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (anchor && panel) {
        positionAt(anchor, panel);
      } else if (attemptsLeft > 0) {
        requestAnimationFrame(() => {
          if (!cancelled) updateWithRetry(attemptsLeft - 1);
        });
      }
    }

    updateWithRetry();
    // capture: true so this also fires for scroll on the table's own
    // overflow-x-auto wrapper, not just window-level scrolling.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    // The panel's own content can change size after the initial
    // positioning - e.g. TimeLogPopover swapping its short session list
    // for SessionEditView's much taller calendar - without any window
    // scroll/resize event firing. Without this, the flip-above/clamp
    // logic above never reruns against the new size, so a panel that
    // grows downward can end up with its bottom clipped off the
    // viewport with no way to reach it.
    const resizeObserver = new ResizeObserver(update);
    if (panelRef.current) resizeObserver.observe(panelRef.current);

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      resizeObserver.disconnect();
    };
  }, [anchorRef, align, gap]);

  if (!mounted) return null;

  return createPortal(
    <div ref={panelRef} style={style} className={className}>
      {children}
    </div>,
    document.body
  );
}
