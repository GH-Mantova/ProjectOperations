// Small module-level store for the PWA "new version available" prompt.
// registerSW() runs at module scope in main.tsx, well before React mounts, so
// we can't hold this state in React alone — the callback would race the tree.
// The store here captures the update signal + the updateSW(true) callback and
// lets any component subscribe via useSyncExternalStore.

export type UpdatePromptState = {
  needRefresh: boolean;
  dismissed: boolean;
};

export type UpdatePromptAction =
  | { type: "needRefresh" }
  | { type: "applyUpdate" }
  | { type: "dismiss" }
  | { type: "reset" };

export const initialUpdatePromptState: UpdatePromptState = {
  needRefresh: false,
  dismissed: false
};

// Pure reducer — exported for unit tests.
export function updatePromptReducer(
  state: UpdatePromptState,
  action: UpdatePromptAction
): UpdatePromptState {
  switch (action.type) {
    case "needRefresh":
      // A fresh signal reopens the toast even if the user dismissed a prior one.
      return { needRefresh: true, dismissed: false };
    case "dismiss":
      if (!state.needRefresh) return state;
      return { needRefresh: state.needRefresh, dismissed: true };
    case "applyUpdate":
      return initialUpdatePromptState;
    case "reset":
      return initialUpdatePromptState;
    default:
      return state;
  }
}

// True iff the toast should currently be visible.
export function isPromptVisible(state: UpdatePromptState): boolean {
  return state.needRefresh && !state.dismissed;
}

type Listener = () => void;

let state: UpdatePromptState = initialUpdatePromptState;
const listeners = new Set<Listener>();
let applyUpdateFn: (() => Promise<void> | void) | null = null;

function dispatch(action: UpdatePromptAction) {
  const next = updatePromptReducer(state, action);
  if (next === state) return;
  state = next;
  for (const l of listeners) l();
}

export const updatePromptStore = {
  getSnapshot(): UpdatePromptState {
    return state;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  // Called from main.tsx once registerSW hands us the SW-update callback.
  setUpdater(fn: (() => Promise<void> | void) | null): void {
    applyUpdateFn = fn;
  },
  signalNeedRefresh(): void {
    dispatch({ type: "needRefresh" });
  },
  dismiss(): void {
    dispatch({ type: "dismiss" });
  },
  applyUpdate(): void {
    const fn = applyUpdateFn;
    dispatch({ type: "applyUpdate" });
    if (fn) void fn();
  },
  // Test-only: reset state + updater between specs.
  _reset(): void {
    state = initialUpdatePromptState;
    applyUpdateFn = null;
    listeners.clear();
  }
};
