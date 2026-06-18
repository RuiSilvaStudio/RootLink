"use client";

import { ReactNode } from "react";

const styles = {
  default: "bg-white border border-primary-200/50 rounded-xl2 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/8 hover:-translate-y-1",
  lift: "bg-white border border-primary-200/50 rounded-xl2 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10 hover:-translate-y-1.5",
  glass: "bg-white/70 backdrop-blur-[10px] border border-white/70 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/5",
  plain: "bg-white border border-primary-200/50 rounded-xl2",
};

type Props = {
  variant?: keyof typeof styles;
  children: ReactNode;
  className?: string;
  as?: "div" | "a" | "article";
  href?: string;
  onClick?: () => void;
};

export function Card({ variant = "default", children, className = "", as: Tag = "div", href, onClick }: Props) {
  const props = href ? { href } : {};
  if (onClick) (props as any).onClick = onClick;
  return (
    <Tag className={`${styles[variant]} ${className}`} {...props}>
      {children}
    </Tag>
  );
}
