import type { PocketAdvance } from "../types";

const STORAGE_KEY = "raden-pocket-advance";

export function loadAdvance(fallback: PocketAdvance): PocketAdvance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function saveAdvance(data: PocketAdvance) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function clearAdvance() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
