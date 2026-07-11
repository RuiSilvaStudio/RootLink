import { SVGProps } from "react";

export function Wordmark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 50"
      fill="currentColor"
      className={className}
      role="img"
      aria-label="RootLink"
      {...props}
    >
      <text
        x="50%"
        y="50%"
        style={{ fontFamily: "var(--font-display)" }}
        fontWeight={700}
        fontSize={36}
        textAnchor="middle"
        dominantBaseline="central"
      >
        RootLink
      </text>
    </svg>
  );
}
