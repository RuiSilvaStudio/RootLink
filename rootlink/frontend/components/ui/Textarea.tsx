"use client";

import { TextareaHTMLAttributes, forwardRef, useId } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ label, error, className = "", id, ...props }, ref) => {
    // useId guarantees uniqueness — label-derived ids collided when two
    // textareas shared a label anywhere on the page
    const autoId = useId();
    const textareaId = id || autoId;
    const errorId = `${textareaId}-error`;
    return (
      <div data-rl-component="Textarea" className="space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-display font-medium text-stone-700 dark:text-stone-300 tracking-wide">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`
            w-full px-4 py-2.5 bg-white dark:bg-stone-900 border rounded-xl2 text-stone-800 dark:text-stone-100 text-sm
            transition-all duration-200 resize-y min-h-[100px]
            placeholder:text-stone-400 dark:placeholder:text-stone-500
            focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none
            ${error ? "border-rust-300 dark:border-rust-700" : "border-primary-200/60 dark:border-stone-700"}
            ${className}
          `.trim()}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="text-xs text-rust-600 dark:text-rust-400 font-display tracking-wide">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
