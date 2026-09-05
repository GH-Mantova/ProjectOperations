import type { CSSProperties, ChangeEvent } from "react";

// PR B1.7 — reusable select that adds a native browser title-tooltip
// matching the currently-selected option's label. For long option lists
// that overflow a fixed-width dropdown, hovering the closed select shows
// the full text. Each <option> also gets a title for hover-over-options
// in the open list.
//
// Designed to be a drop-in replacement for native <select> inside the
// scope items table. Visual parity via the .s7-input class.
//
// SCOPE_PLANT_PICKER_V2 — the component learned <optgroup>. The grouped form
// is an ADDITIONAL, OPT-IN prop (`optionGroups`) that sits alongside the flat
// `options` list rather than replacing it: every call site that passes only
// `options` renders exactly the markup it rendered before this change — one
// unconditional blank <option> followed by a flat options.map — and only the
// plant Type select passes groups. Both forms may be passed together (flat
// options render first, then the groups), which is how a call site would keep
// an ungrouped head above grouped tails if one ever needs to.
//
// The two contracts this component exists for hold across both forms:
//   - the closed <select> carries the SELECTED option's label as its `title`,
//     resolved across flat options AND every group;
//   - every <option> carries its own label as its own `title`.
// So does the "" -> onChange(null) mapping, and so does the single blank
// <option>: SCOPE_WBS_INPUTS_V2 made this component's own blank the only one
// in the list, and nothing here adds a second.

export type TooltipSelectOption<T extends string | number> = {
  value: T;
  label: string;
  disabled?: boolean;
};

/**
 * SCOPE_PLANT_PICKER_V2 — one `<optgroup>`: a heading plus the options under
 * it. Order is the array's order, both for the groups and within a group;
 * the component sorts nothing and drops nothing.
 */
export type TooltipSelectOptionGroup<T extends string | number> = {
  label: string;
  options: ReadonlyArray<TooltipSelectOption<T>>;
};

// Module-level so the defaults keep a stable identity across renders.
const NO_OPTIONS: ReadonlyArray<never> = [];
const NO_GROUPS: ReadonlyArray<never> = [];

type Props<T extends string | number> = {
  value: T | null | undefined;
  /**
   * The flat option list. Optional only so that a grouped-only call site is
   * not forced to pass an empty array; every pre-existing call site passes it
   * and is unaffected.
   */
  options?: ReadonlyArray<TooltipSelectOption<T>>;
  /** SCOPE_PLANT_PICKER_V2 — opt-in grouped options, rendered as <optgroup>. */
  optionGroups?: ReadonlyArray<TooltipSelectOptionGroup<T>>;
  onChange: (value: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  ariaLabel?: string;
};

export function TooltipSelect<T extends string | number>({
  value,
  options = NO_OPTIONS,
  optionGroups = NO_GROUPS,
  onChange,
  placeholder = "—",
  disabled,
  style,
  className,
  ariaLabel
}: Props<T>) {
  // Every selectable option, flat first then each group in order. This is the
  // lookup set for BOTH the title and the change handler: an option that is
  // only reachable through a group still resolves its tooltip and still comes
  // back out of onChange as its own value rather than as null.
  const allOptions: ReadonlyArray<TooltipSelectOption<T>> =
    optionGroups.length === 0
      ? options
      : [...options, ...optionGroups.flatMap((g) => [...g.options])];

  const selected = allOptions.find((o) => o.value === value);
  const title = selected?.label ?? placeholder;

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(null);
      return;
    }
    const match = allOptions.find((o) => String(o.value) === raw);
    onChange(match ? match.value : null);
  };

  const renderOption = (opt: TooltipSelectOption<T>) => (
    <option
      key={String(opt.value)}
      value={String(opt.value)}
      disabled={opt.disabled}
      title={opt.label}
    >
      {opt.label}
    </option>
  );

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
      {options.map(renderOption)}
      {optionGroups.map((group, i) => (
        <optgroup key={`${group.label}:${i}`} label={group.label}>
          {group.options.map(renderOption)}
        </optgroup>
      ))}
    </select>
  );
}
