"use client";

import { useEffect, useCallback, useRef } from "react";

export function useDirtyGuard(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const confirmLeave = useCallback((message?: string) => {
    if (dirtyRef.current) {
      return window.confirm(message || "You have unsaved changes. Leave anyway?");
    }
    return true;
  }, []);

  return { confirmLeave };
}
