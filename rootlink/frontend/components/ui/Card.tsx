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
  // Forwarded onto the root element so callers (e.g. block components) can
  // override the data-rl-component value with their own block name.
  "data-rl-component"?: string;
};

export function Card({ variant = "default", children, className = "", as: Tag = "div", href, onClick, ...rest }: Props) {
  const props = href ? { href } : {};
  if (onClick) (props as any).onClick = onClick;
  return (
    <Tag data-rl-component="Card" className={`${styles[variant]} ${className}`} {...props} {...rest}>
      {children}
    </Tag>
  );
}
