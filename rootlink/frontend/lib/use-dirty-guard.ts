"use client";

import { useEffect, useCallback, useRef } from "react";

const DEFAULT_MESSAGE = "You have unsaved changes. Leave anyway?";

interface DirtyGuardOptions {
  /** Custom confirm() text. Note: browsers ignore custom text for the native
   *  beforeunload prompt (refresh/tab-close) — this only affects the in-app
   *  <Link>-click confirm below. */
  message?: string;
  /** Called once the user confirms leaving (i.e. chooses to discard). Only
   *  fires for in-app link clicks — not for beforeunload, since the page is
   *  already being destroyed/navigated away by the time that fires. */
  onConfirmedLeave?: () => void;
}

export function useDirtyGuard(dirty: boolean, options?: DirtyGuardOptions) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!dirty) return;

    // 1) Hard navigation (refresh / tab close / external link). Browsers force
    //    their own generic 2-button prompt here — custom text/buttons are not
    //    possible (security restriction across all modern browsers).
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    // 2) In-app navigation via <a>/<Link> clicks (e.g. the nav logo). Next.js
    //    App Router has no route-change event, so we intercept the click in the
    //    capture phase and cancel it if the user chooses to stay.
    const clickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      if (window.confirm(optionsRef.current?.message || DEFAULT_MESSAGE)) {
        optionsRef.current?.onConfirmedLeave?.();
      } else {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", clickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", clickCapture, true);
    };
  }, [dirty]);

  const confirmLeave = useCallback((message?: string) => {
    if (dirtyRef.current) {
      return window.confirm(message || DEFAULT_MESSAGE);
    }
    return true;
  }, []);

  return { confirmLeave };
}
