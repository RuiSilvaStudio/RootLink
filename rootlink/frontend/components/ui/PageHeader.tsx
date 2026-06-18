import { ReactNode } from "react";
import { Badge } from "./Badge";

type Props = {
  icon?: ReactNode;
  badge?: string;
  title: string;
  description?: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({ icon, badge, title, description, subtitle, action, children, className = "" }: Props) {
  const desc = description || subtitle;
  return (
    <header className={`max-w-2xl ${className}`}>
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-primary-100/50 flex items-center justify-center mb-5">
          {icon}
        </div>
      )}
      {badge && <Badge variant="sage" className="mb-5">{badge}</Badge>}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-semibold text-stone-800 leading-[1.08] tracking-tight">
        {title}
      </h1>
      <div className="mt-4 w-16 h-0.5 bg-primary-300/60 rounded-full" />
      {desc && (
        <p className="mt-6 text-lg text-stone-500 leading-relaxed font-serif max-w-xl">
          {desc}
        </p>
      )}
      {action && (
        <div className="mt-6">{action}</div>
      )}
      {children}
    </header>
  );
}
