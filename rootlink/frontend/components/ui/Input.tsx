"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className = "", id, ...props }, ref) => {
    // useId guarantees uniqueness — label-derived ids collided when two
    // inputs shared a label anywhere on the page
    const autoId = useId();
    const inputId = id || autoId;
    const errorId = `${inputId}-error`;
    return (
      <div data-rl-component="Input" className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-display font-medium text-stone-700 dark:text-stone-300 tracking-wide">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`
            w-full px-4 py-2.5 bg-white dark:bg-stone-900 border rounded-xl2 text-stone-800 dark:text-stone-100 text-sm
            transition-all duration-200
            placeholder:text-stone-400 dark:placeholder:text-stone-500
            focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none
            ${error ? "border-rust-300 focus:border-rust-400 focus:ring-rust-500/15" : "border-primary-200/60 dark:border-stone-700"}
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
Input.displayName = "Input";
