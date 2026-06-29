"use client";

import { useEffect, useCallback, useRef } from "react";

export function useDirtyGuard(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;

    // 1) Hard navigation (refresh / tab close / external link).
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
      if (!window.confirm("You have unsaved changes. Leave anyway?")) {
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
      return window.confirm(message || "You have unsaved changes. Leave anyway?");
    }
    return true;
  }, []);

  return { confirmLeave };
}
