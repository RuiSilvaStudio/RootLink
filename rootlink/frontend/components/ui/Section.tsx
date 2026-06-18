import { ReactNode } from "react";
import { Badge } from "./Badge";

type Props = {
  badge?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
  variant?: "default" | "muted";
};

export function Section({ badge, title, description, children, className = "", as: Tag = "section", variant = "default" }: Props) {
  return (
    <Tag className={`px-4 sm:px-8 py-20 sm:py-28 ${variant === "muted" ? "bg-primary-50/40" : ""} ${className}`}>
      <div className="max-w-6xl mx-auto">
        {(badge || title) && (
          <div className="text-center mb-14">
            {badge && <Badge variant="sage" className="mb-4">{badge}</Badge>}
            {title && (
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-semibold text-stone-800 leading-[1.1] tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-5 text-lg text-stone-500 max-w-lg mx-auto font-serif leading-relaxed">
                {description}
              </p>
            )}
            <div className="mt-6 mx-auto w-16 h-0.5 bg-primary-300/40 rounded-full" />
          </div>
        )}
        {children}
      </div>
    </Tag>
  );
}
