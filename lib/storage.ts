import { MAX_SEEN, STORAGE_PREFIX } from "./feeds";

export type SeenState = {
  /** Meest recent geziene GUID vooraan. */
  order: string[];
  set: Set<string>;
  /** false = nog nooit geladen op dit apparaat; die eerste lading wordt de nulmeting. */
  initialized: boolean;
};

function storageKey(tabId: string): string {
  return STORAGE_PREFIX + tabId;
}

export function loadSeen(tabId: string): SeenState {
  try {
    const raw = window.localStorage.getItem(storageKey(tabId));
    if (!raw) return { order: [], set: new Set(), initialized: false };

    const parsed: unknown = JSON.parse(raw);
    const stored =
      parsed && typeof parsed === "object" && "seen" in parsed
        ? (parsed as { seen: unknown }).seen
        : null;

    if (!Array.isArray(stored)) {
      return { order: [], set: new Set(), initialized: false };
    }

    const order = stored.filter((g): g is string => typeof g === "string");
    return { order, set: new Set(order), initialized: true };
  } catch {
    // Opslag geblokkeerd of corrupt: gedraag je als een eerste bezoek.
    return { order: [], set: new Set(), initialized: false };
  }
}

function persist(tabId: string, order: string[]): void {
  try {
    window.localStorage.setItem(
      storageKey(tabId),
      JSON.stringify({ seen: order }),
    );
  } catch {
    // Geen opslag beschikbaar; de teller werkt dan alleen binnen deze sessie.
  }
}

export function markSeen(
  tabId: string,
  state: SeenState,
  guids: string[],
): void {
  let changed = false;

  for (const guid of guids) {
    if (!state.set.has(guid)) {
      state.set.add(guid);
      state.order.unshift(guid);
      changed = true;
    }
  }

  if (!changed) return;

  if (state.order.length > MAX_SEEN) {
    state.order = state.order.slice(0, MAX_SEEN);
    state.set = new Set(state.order);
  }

  persist(tabId, state.order);
}
