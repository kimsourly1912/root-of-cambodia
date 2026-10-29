"use client";
import { useState } from "react";
export function StayPhoto({
  src,
  alt,
  eager = false,
}: {
  src?: string;
  alt: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="aspect-[4/3] overflow-hidden rounded-lg bg-secondary">
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          width={960}
          height={720}
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={alt + " unavailable"}
          className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground"
        >
          Photo unavailable
        </div>
      )}
    </div>
  );
}
