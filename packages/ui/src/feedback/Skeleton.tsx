import type { CSSProperties } from "react";

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({ width = "100%", height = 14, radius, className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={className ? `skeleton ${className}` : "skeleton"}
      style={{
        display: "block",
        width,
        height,
        borderRadius: radius ?? "var(--radius-sm, 6px)",
        ...style
      }}
    />
  );
}

type SkeletonListProps = {
  count?: number;
  rowHeight?: number;
  gap?: number;
};

export function SkeletonList({ count = 3, rowHeight = 16, gap = 12 }: SkeletonListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} height={rowHeight} width={`${80 + ((index * 7) % 20)}%`} />
      ))}
    </div>
  );
}
