import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import "./AddressAutocomplete.css";

// Suggestion payload as returned by GET /geo/autocomplete. The API endpoint
// keeps the Geoapify key server-side; the browser only sees the trimmed list.
export type AddressSuggestion = {
  formatted: string;
  addressLine1: string | null;
  addressLine2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  countryCode: string | null;
  lat: number | null;
  lon: number | null;
  placeId: string | null;
};

type AutocompleteResponse = {
  configured: boolean;
  results: AddressSuggestion[];
  reason?: string;
};

export type AddressAutocompleteProps = {
  value: string;
  onValueChange: (formatted: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  inputId?: string;
  ariaDescribedBy?: string;
  dataTestId?: string;
};

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 3;

// Free-typing shows suggestions as the user pauses; picking one calls
// `onSelect`. `onValueChange` keeps the parent input in sync so the form field
// still reflects whatever the user has typed even before they pick a match.
export function AddressAutocomplete(props: AddressAutocompleteProps) {
  const { authFetch } = useAuth();
  const {
    value,
    onValueChange,
    onSelect,
    placeholder = "Start typing an address…",
    required,
    disabled,
    autoFocus,
    inputId,
    ariaDescribedBy,
    dataTestId
  } = props;

  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef(0);

  // Debounced autocomplete request. Every keystroke bumps the request seq so a
  // slow earlier response can never overwrite a fresher one.
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setResults([]);
      setNotice(null);
      setNotConfigured(false);
      return;
    }
    const seq = ++requestSeqRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await authFetch(
          `/geo/autocomplete?text=${encodeURIComponent(trimmed)}`
        );
        if (seq !== requestSeqRef.current) return;
        if (!res.ok) {
          setResults([]);
          setNotice("Address lookup failed.");
          return;
        }
        const body = (await res.json()) as AutocompleteResponse;
        if (seq !== requestSeqRef.current) return;
        setResults(body.results ?? []);
        setNotConfigured(!body.configured);
        setNotice(body.reason ?? null);
      } catch {
        if (seq !== requestSeqRef.current) return;
        setResults([]);
        setNotice("Address lookup service unavailable.");
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, authFetch]);

  // Click-outside closes the dropdown so it doesn't stay open behind other
  // wizard controls after the user moves on.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handlePick = (suggestion: AddressSuggestion) => {
    onValueChange(suggestion.formatted);
    onSelect(suggestion);
    setOpen(false);
  };

  const showDropdown = open && (loading || results.length > 0 || notice !== null);

  const helperId = useMemo(
    () => (inputId ? `${inputId}-status` : undefined),
    [inputId]
  );

  return (
    <div className="address-autocomplete" ref={containerRef}>
      <input
        id={inputId}
        className="s7-input"
        type="text"
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-describedby={ariaDescribedBy ?? helperId}
        data-testid={dataTestId}
      />
      {showDropdown ? (
        <div
          className="address-autocomplete__results"
          role="listbox"
          data-testid={dataTestId ? `${dataTestId}-results` : undefined}
        >
          {loading ? (
            <div className="address-autocomplete__empty">Searching…</div>
          ) : null}
          {!loading && results.length === 0 && notConfigured ? (
            <div className="address-autocomplete__empty">
              {notice ?? "Address lookup is not configured."}
            </div>
          ) : null}
          {!loading && results.length === 0 && !notConfigured ? (
            <div className="address-autocomplete__empty">
              {notice ?? "No matches — try typing more of the address."}
            </div>
          ) : null}
          {results.map((r, idx) => (
            <button
              key={`${r.placeId ?? "no-id"}-${idx}`}
              type="button"
              role="option"
              aria-selected="false"
              className="address-autocomplete__item"
              onClick={() => handlePick(r)}
              data-testid={dataTestId ? `${dataTestId}-item-${idx}` : undefined}
            >
              <span className="address-autocomplete__item-primary">{r.formatted}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
