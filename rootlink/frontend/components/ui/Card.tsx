"use client";

import { ReactNode } from "react";

const styles = {
  default: "card-lift",
  lift: "card-lift",
  glass: "glass-card",
  plain: "card-plain",
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
