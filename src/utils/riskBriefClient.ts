import type { PocketAdvance } from "../types";
import type { RiskBrief } from "./riskBriefTypes";

export async function generateRiskBrief(opts: {
  advance: PocketAdvance;
  redactMode: boolean;
}): Promise<RiskBrief> {
  const resp = await fetch("/.netlify/functions/risk-brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  const text = await resp.text();

  if (!resp.ok) {
    throw new Error(text || "Risk brief failed");
  }

  return JSON.parse(text) as RiskBrief;
}
