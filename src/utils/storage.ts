import type { PocketAdvance } from "../types";

const KEY = "raden_pocket_advance_v2";

function cleanText(value: unknown, maxLen = 240): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    ""
  );
  return cleaned.slice(0, maxLen);
}

function cleanTime(value: unknown): string {
  if (typeof value !== "string") return "";
  if (!/^\d{2}:\d{2}$/.test(value)) return "";
  return value;
}

function cleanDate(value: unknown): string {
  if (typeof value !== "string") return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return value;
}

export function saveAdvance(data: PocketAdvance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore (private mode / quota)
  }
}

export function clearAdvance() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function loadAdvance(defaultValue: PocketAdvance): PocketAdvance {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultValue;

    const parsed = JSON.parse(raw) as Partial<PocketAdvance>;

    const merged: PocketAdvance = {
      ...defaultValue,
      ...parsed,
      agents: Array.isArray(parsed.agents)
        ? parsed.agents
        : defaultValue.agents,
      pocs: Array.isArray(parsed.pocs) ? parsed.pocs : defaultValue.pocs,
      boloPois: Array.isArray(parsed.boloPois)
        ? parsed.boloPois
        : defaultValue.boloPois,
    };

    merged.detailName =
      cleanText(merged.detailName, 120) || defaultValue.detailName;
    merged.venueName =
      cleanText(merged.venueName, 120) || defaultValue.venueName;
    merged.address = cleanText(merged.address, 220) || defaultValue.address;
    merged.teamLead = cleanText(merged.teamLead, 80) || defaultValue.teamLead;

    merged.date = cleanDate(merged.date) || defaultValue.date;
    merged.timeOn = cleanTime(merged.timeOn) || defaultValue.timeOn;
    merged.timeOff = cleanTime(merged.timeOff) || defaultValue.timeOff;
    merged.arrivalTime = cleanTime(merged.arrivalTime) || "";
    merged.departTime = cleanTime(merged.departTime) || "";
    merged.alphaArrival = cleanText((merged as any).alphaArrival, 180);
    
    merged.alphaDeparture = cleanText((merged as any).alphaDeparture, 180);
    merged.bravoArrival = cleanText((merged as any).bravoArrival, 180);
    merged.bravoDeparture = cleanText((merged as any).bravoDeparture, 180);

    merged.primaryComms = cleanText(merged.primaryComms, 80);
    merged.secondaryComms = cleanText(merged.secondaryComms, 80);
    merged.codeWords = cleanText(merged.codeWords, 80);

    merged.erName = cleanText(merged.erName, 80);
    merged.erAddress = cleanText(merged.erAddress, 220);
    merged.erPhone = cleanText(merged.erPhone, 40);

    merged.leName = cleanText(merged.leName, 80);
    merged.leAddress = cleanText(merged.leAddress, 220);
    merged.lePhone = cleanText(merged.lePhone, 40);

    merged.notes = cleanText(merged.notes, 1400);

    merged.agents = (merged.agents || []).map((a) => ({
      name: cleanText(a?.name, 60),
      role: cleanText(a?.role, 60),
      phone: cleanText(a?.phone, 40),
    }));

    merged.pocs = (merged.pocs || []).map((p) => ({
      name: cleanText(p?.name, 60),
      roleOrg: cleanText(p?.roleOrg, 80),
      phone: cleanText(p?.phone, 40),
      notes: cleanText(p?.notes, 500),
    }));

    merged.boloPois = (merged.boloPois || []).map((b) => ({
      type: b?.type === "POI" ? "POI" : "BOLO",
      subject: cleanText(b?.subject, 140),
      description: cleanText(b?.description, 650),
      lastKnown: cleanText(b?.lastKnown, 180),
      action: cleanText(b?.action, 180),
    }));

    return merged;
  } catch {
    return defaultValue;
  }
}
