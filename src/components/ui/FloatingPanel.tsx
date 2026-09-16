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
  const [mounted, setMounted] = useState(false);

  // createPortal needs document.body, which doesn't exist during SSR — this
  // defers the portal to the client-only mount pass, the standard fix for
  // that (not a derived-state pattern the lint rule is meant to catch).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    function update() {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

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

    update();
    // capture: true so this also fires for scroll on the table's own
    // overflow-x-auto wrapper, not just window-level scrolling.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
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
