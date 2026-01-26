import type { PocketAdvance } from "../types";
import type { RiskBrief } from "./riskBriefTypes";

export async function generateRiskBrief(params: {
  advance: PocketAdvance;
  redactMode: boolean;
}): Promise<RiskBrief> {
  const res = await fetch("/.netlify/functions/risk-brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Risk brief request failed");
  }

  return res.json();
}
