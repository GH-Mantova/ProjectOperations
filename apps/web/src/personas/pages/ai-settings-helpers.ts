export type ProviderKey = "anthropic" | "openai" | "gemini" | "groq";

export type ProviderOption = { value: ProviderKey; label: string };

export type GlobalSettings = {
  allowUserInstructionOverrides: boolean;
  enabledProviders: string[];
  allowBringYourOwnKey: boolean;
};

export type UserPersonaSettings = {
  providerOverride: string | null;
  instructionOverride: string | null;
  bringYourOwnKey: string | null;
};

export type CompanyInstruction = {
  instruction: string;
};

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI GPT",
  gemini: "Google Gemini",
  groq: "Groq"
};

const ALL_PROVIDER_KEYS: ProviderKey[] = ["anthropic", "openai", "gemini", "groq"];

export function getProviderLabel(key: string): string {
  return PROVIDER_LABELS[key as ProviderKey] ?? key;
}

export function dropdownOptionsFromEnabledProviders(enabled: string[]): ProviderOption[] {
  const enabledSet = new Set(enabled);
  return ALL_PROVIDER_KEYS.filter((key) => enabledSet.has(key)).map((key) => ({
    value: key,
    label: PROVIDER_LABELS[key]
  }));
}

export function shouldShowPersonalInstructionField(global: GlobalSettings | null): boolean {
  return global?.allowUserInstructionOverrides === true;
}

export function shouldShowBYOKSection(global: GlobalSettings | null): boolean {
  return global?.allowBringYourOwnKey === true;
}

// Deep-equal-by-stringify for the small flat shapes we care about. Good enough
// here — the structures are { providerOverride, instructionOverride } plus
// primitives, no nested objects.
export function hasUnsavedChanges<T>(initial: T, current: T): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current);
}

export type TabId = "company" | "mine";

// Sean (Super User) defaults to Company. Everyone else gets My Settings only —
// they can't select Company because the tab bar isn't even rendered for them.
export function getInitialTab(isSuperUser: boolean | undefined): TabId {
  return isSuperUser ? "company" : "mine";
}

export function canViewCompanyTab(isSuperUser: boolean | undefined): boolean {
  return isSuperUser === true;
}

// "ai.persona.tendering" matches the prefix; future personas register their
// own permissions following the same prefix, so this stays correct as new
// personas land.
export function hasAnyPersonaPermission(permissions: string[] | undefined): boolean {
  return (permissions ?? []).some((p) => p.startsWith("ai.persona."));
}

// Page-level access: Super Users always see the page (so Sean can configure
// company settings even if no per-persona permission is granted to him by
// roles); everyone else needs at least one ai.persona.* permission.
export function canViewAiSettingsPage(
  isSuperUser: boolean | undefined,
  permissions: string[] | undefined
): boolean {
  if (isSuperUser) return true;
  return hasAnyPersonaPermission(permissions);
}
