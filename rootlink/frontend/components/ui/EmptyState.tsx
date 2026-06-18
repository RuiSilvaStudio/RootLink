import { ReactNode } from "react";
import { Button } from "./Button";

type Props = {
  icon?: ReactNode;
  title: string;
  message?: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void } | ReactNode;
  children?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, message, subtitle, action, children, className = "" }: Props) {
  const msg = message || subtitle;
  return (
    <div className={`text-center py-16 px-6 ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-primary-100/60 flex items-center justify-center mx-auto mb-6">
          {icon}
        </div>
      )}
      <h3 className="text-2xl font-display font-semibold text-stone-700">{title}</h3>
      {msg && (
        <p className="mt-3 text-stone-500 max-w-sm mx-auto font-serif leading-relaxed">{msg}</p>
      )}
      {action && (
        <div className="mt-8">
          {isActionObject(action) ? (
            <Button variant="secondary" onClick={action.onClick}>{action.label}</Button>
          ) : (
            action
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function isActionObject(a: any): a is { label: string; onClick: () => void } {
  return a && typeof a === "object" && "label" in a && "onClick" in a;
}
