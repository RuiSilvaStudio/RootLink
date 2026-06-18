"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

const variants = {
  primary:
    "bg-primary-600 text-cream hover:bg-primary-700 active:bg-primary-800 shadow-sm hover:shadow-md",
  secondary:
    "border border-primary-300/60 text-primary-700 hover:border-primary-400 hover:bg-primary-50",
  ghost:
    "text-stone-500 hover:text-primary-700 hover:bg-primary-50/50",
  danger:
    "bg-rust-50 text-rust-700 border border-rust-200 hover:bg-rust-100",
};

const sizes = {
  sm: "px-4 py-1.5 text-sm rounded-lg",
  md: "px-6 py-2.5 text-base rounded-xl2",
  lg: "px-8 py-3.5 text-lg rounded-xl2",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", loading, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2
          font-display font-medium tracking-wide
          transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40
          ${variants[variant]} ${sizes[size]}
          ${(disabled || loading) ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5"}
          ${className}
        `.trim()}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
