import { SVGProps } from "react";

export function BrandIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M50 20 V50 M30 60 L50 50 L70 60 M30 80 L50 70 L70 80 M50 50 L50 70" />
    </svg>
  );
}
