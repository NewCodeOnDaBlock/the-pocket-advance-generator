import type { PocketAdvance } from "../types";

const KEY = "pocket_advance_v1";

export function saveAdvance(data: PocketAdvance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function loadAdvance(fallback: PocketAdvance): PocketAdvance {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function clearAdvance() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
