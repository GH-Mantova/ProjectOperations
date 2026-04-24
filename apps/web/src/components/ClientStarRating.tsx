import { useState } from "react";

export type ClientStarRatingProps = {
  score: number | null | undefined;
  readOnly?: boolean;
  size?: "sm" | "md";
  onChange?: (score: number) => void;
  ariaLabel?: string;
};

const FILLED_COLOR = "#F59E0B";
const EMPTY_COLOR = "#CBD5E1";

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? FILLED_COLOR : "none"}
      stroke={filled ? FILLED_COLOR : EMPTY_COLOR}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function ClientStarRating({
  score,
  readOnly = false,
  size = "md",
  onChange,
  ariaLabel
}: ClientStarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const pixelSize = size === "sm" ? 12 : 18;
  const active = hover ?? score ?? 0;

  if (readOnly) {
    return (
      <span
        aria-label={ariaLabel ?? (score ? `${score} of 5 stars` : "No rating")}
        style={{ display: "inline-flex", gap: 1, lineHeight: 0, verticalAlign: "middle" }}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <Star key={value} filled={value <= (score ?? 0)} size={pixelSize} />
        ))}
      </span>
    );
  }

  return (
    <span
      role="radiogroup"
      aria-label={ariaLabel ?? "Client preference rating"}
      style={{ display: "inline-flex", gap: 2, lineHeight: 0 }}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={score === value}
          aria-label={`${value} star${value > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(value)}
          onClick={() => onChange?.(value)}
          style={{
            background: "transparent",
            border: "none",
            padding: 1,
            cursor: "pointer",
            lineHeight: 0
          }}
        >
          <Star filled={value <= active} size={pixelSize} />
        </button>
      ))}
    </span>
  );
}
