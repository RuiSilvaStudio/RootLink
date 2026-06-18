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

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={`${sizeMap[size]} rounded-full object-cover ring-2 ring-white ${className}`}
      />
    );
  }

  return (
    <div className={`${sizeMap[size]} rounded-full bg-primary-100 text-primary-600 font-display font-medium flex items-center justify-center ring-2 ring-white ${className}`}>
      {initials || "?"}
    </div>
  );
}
