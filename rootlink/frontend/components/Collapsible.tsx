"use client";
import { ReactNode, useRef, useState, useEffect } from "react";

export function Collapsible({ open, children, className = "" }: { open: boolean; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (ref.current) {
      setContentHeight(ref.current.scrollHeight);
    }
  }, [open]);

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${className}`}
      style={{ maxHeight: open ? contentHeight : 0 }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}
