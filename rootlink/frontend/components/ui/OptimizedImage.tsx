"use client";

import { useState, useRef, useEffect } from "react";

type SizePreset = "original" | "large" | "medium" | "thumb";

interface OptimizedImageProps {
  src: string | null | undefined;
  alt?: string;
  size?: SizePreset;
  className?: string;
  fallback?: React.ReactNode;
  onError?: () => void;
  loading?: "lazy" | "eager";
}

export function OptimizedImage({
  src,
  alt = "",
  size = "medium",
  className = "",
  fallback,
  onError,
  loading = "lazy",
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setError(false);
    setLoaded(false);
  }, [src]);

  if (!src || error) {
    if (fallback) return <>{fallback}</>;
    return null;
  }

  return (
    <>
      {!loaded && (
        <div className={`bg-stone-100 animate-pulse ${className}`} />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={loading}
        className={`${className} ${loaded ? "" : "hidden"}`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          onError?.();
        }}
      />
    </>
  );
}
