import { ReactNode } from "react";
import { Button } from "./Button";

type Props = {
  icon?: ReactNode;
  // string -> ReactNode: purely additive (a string is a valid ReactNode), so
  // every existing `title={t("x")}` / `title="..."` call site keeps working.
  // Lets pages pass `<Text k="x" as="span" defaultText="..." />` here so the
  // Content Studio overlay can edit empty-state copy (data-rl-text on the child).
  title: ReactNode;
  message?: ReactNode;
  subtitle?: ReactNode;
  action?: { label: string; onClick: () => void } | ReactNode;
  children?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, message, subtitle, action, children, className = "" }: Props) {
  const msg = message || subtitle;
  return (
    <div data-rl-component="EmptyState" className={`text-center py-16 px-6 ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-primary-100/60 dark:bg-primary-900/40 flex items-center justify-center mx-auto mb-6">
          {icon}
        </div>
      )}
      <h3 className="text-2xl font-display font-semibold text-stone-700 dark:text-stone-200">{title}</h3>
      {msg && (
        <p className="mt-3 text-stone-500 dark:text-stone-400 max-w-sm mx-auto font-serif leading-relaxed">{msg}</p>
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
