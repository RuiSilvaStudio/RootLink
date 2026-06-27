import { safeImageUrl } from "@/lib/image-url";

type Props = {
  src?: string | null;
  name?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
};

export function Avatar({ src, name, fallback, size = "md", className = "" }: Props) {
  const label = name || fallback || "";
  const initials = label
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const safeSrc = safeImageUrl(src);
  if (safeSrc) {
    return (
      <img
        src={safeSrc}
        alt={label}
        className={`${sizeMap[size]} rounded-full object-cover ring-2 ring-white dark:ring-stone-800 ${className}`}
      />
    );
  }

  return (
    <div className={`${sizeMap[size]} rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 font-display font-medium flex items-center justify-center ring-2 ring-white dark:ring-stone-800 ${className}`}>
      {initials || "?"}
    </div>
  );
}
