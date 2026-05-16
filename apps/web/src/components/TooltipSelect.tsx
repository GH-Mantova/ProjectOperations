import type { CSSProperties, ChangeEvent } from "react";

// PR B1.7 — reusable select that adds a native browser title-tooltip
// matching the currently-selected option's label. For long option lists
// that overflow a fixed-width dropdown, hovering the closed select shows
// the full text. Each <option> also gets a title for hover-over-options
// in the open list.
//
// Designed to be a drop-in replacement for native <select> inside the
// scope items table. Visual parity via the .s7-input class.

export type TooltipSelectOption<T extends string | number> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type Props<T extends string | number> = {
  value: T | null | undefined;
  options: ReadonlyArray<TooltipSelectOption<T>>;
  onChange: (value: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  ariaLabel?: string;
};

export function TooltipSelect<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = "—",
  disabled,
  style,
  className,
  ariaLabel
}: Props<T>) {
  const selected = options.find((o) => o.value === value);
  const title = selected?.label ?? placeholder;

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(null);
      return;
    }
    const match = options.find((o) => String(o.value) === raw);
    onChange(match ? match.value : null);
  };

  return (
    <select
      className={className ?? "s7-input"}
      value={value ?? ""}
      onChange={handleChange}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      style={style}
    >
      <option value="" title={placeholder}>
        {placeholder}
      </option>
      {options.map((opt) => (
        <option
          key={String(opt.value)}
          value={String(opt.value)}
          disabled={opt.disabled}
          title={opt.label}
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}
