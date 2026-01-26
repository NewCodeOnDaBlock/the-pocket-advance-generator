import type { Handler } from "@netlify/functions";

type RiskBrief = {
  summary: string;
  threat_level: "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
  key_risks: Array<{ title: string; why_it_matters: string }>;
  vulnerabilities: Array<{ title: string; note: string }>;
  mitigations: Array<{ title: string; steps: string }>;
  go_no_go: { go_if: string[]; no_go_if: string[] };
  missing_info_questions: string[];
};

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function coerceRiskBrief(input: any): RiskBrief {
  const threat: RiskBrief["threat_level"] =
    input?.threat_level === "LOW" ||
    input?.threat_level === "MODERATE" ||
    input?.threat_level === "ELEVATED" ||
    input?.threat_level === "HIGH"
      ? input.threat_level
      : "MODERATE";

  const asArray = (v: any) => (Array.isArray(v) ? v : []);
  const asString = (v: any) => (typeof v === "string" ? v : "");

  const key_risks = asArray(input?.key_risks)
    .map((x: any) => ({
      title: asString(x?.title).slice(0, 140),
      why_it_matters: asString(x?.why_it_matters).slice(0, 320),
    }))
    .filter((x: any) => x.title.trim())
    .slice(0, 6);

  const vulnerabilities = asArray(input?.vulnerabilities)
    .map((x: any) => ({
      title: asString(x?.title).slice(0, 140),
      note: asString(x?.note).slice(0, 320),
    }))
    .filter((x: any) => x.title.trim())
    .slice(0, 6);

  const mitigations = asArray(input?.mitigations)
    .map((x: any) => ({
      title: asString(x?.title).slice(0, 140),
      steps: asString(x?.steps).slice(0, 500),
    }))
    .filter((x: any) => x.title.trim())
    .slice(0, 6);

  const go_if = asArray(input?.go_no_go?.go_if)
    .map((x: any) => asString(x).slice(0, 200))
    .filter((x: string) => x.trim())
    .slice(0, 6);

  const no_go_if = asArray(input?.go_no_go?.no_go_if)
    .map((x: any) => asString(x).slice(0, 200))
    .filter((x: string) => x.trim())
    .slice(0, 6);

  const missing_info_questions = asArray(input?.missing_info_questions)
    .map((x: any) => asString(x).slice(0, 220))
    .filter((x: string) => x.trim())
    .slice(0, 8);

  return {
    summary: asString(input?.summary).slice(0, 800),
    threat_level: threat,
    key_risks,
    vulnerabilities,
    mitigations,
    go_no_go: { go_if, no_go_if },
    missing_info_questions,
  };
}

function redactAdvance(advance: any) {
  const clone = JSON.parse(JSON.stringify(advance ?? {}));

  const redactKeys = [
    "address",
    "erAddress",
    "erPhone",
    "leAddress",
    "lePhone",
    "alphaArrival",
    "alphaDeparture",
    "bravoArrival",
    "bravoDeparture",
  ];

  for (const k of redactKeys) {
    if (typeof clone[k] === "string" && clone[k].trim()) clone[k] = "REDACTED";
  }

  if (Array.isArray(clone?.agents)) {
    clone.agents = clone.agents.map((a: any) => ({
      ...a,
      phone: a?.phone?.trim() ? "REDACTED" : "",
    }));
  }

  if (Array.isArray(clone?.pocs)) {
    clone.pocs = clone.pocs.map((p: any) => ({
      ...p,
      phone: p?.phone?.trim() ? "REDACTED" : "",
    }));
  }

  if (Array.isArray(clone?.boloPois)) {
    clone.boloPois = clone.boloPois.map((b: any) => ({
      ...b,
      lastKnown: b?.lastKnown?.trim() ? "REDACTED" : "",
    }));
  }

  return clone;
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    if (event.httpMethod !== "POST")
      return json(405, { error: "Method not allowed" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(500, {
        error:
          "Missing OPENAI_API_KEY environment variable. Add it in Netlify site settings.",
      });
    }

    const parsed = event.body ? JSON.parse(event.body) : {};
    const advance = parsed?.advance ?? {};
    const redactMode = Boolean(parsed?.redactMode);

    const inputAdvance = redactMode ? redactAdvance(advance) : advance;

    const system = `
    You are an experienced executive protection (EP) advance and operations planner.
    Generate a concise, practical "AI Risk Brief" for the provided Pocket Advance.
    
    GOAL
    - Add operational value beyond summarizing inputs.
    - Identify actionable planning gaps and mitigation steps.
    - Keep tone calm, professional, and non-alarmist.
    
    NON-NEGOTIABLE RULES
    - Output MUST be valid JSON that matches the provided schema exactly.
    - Do NOT invent specific facts, named threats, intel, statistics, or venue-specific policies unless explicitly provided in the input.
    - Do NOT provide probabilistic claims (e.g., "80% chance") or crime rate claims.
    - Focus on risk drivers, vulnerabilities, and mitigations that are generic-but-useful given the inputs.
    - If key information is missing, reflect that via:
      - planning_confidence and confidence_rationale
      - missing_info_questions
      - vulnerabilities and mitigations
    
    CONTENT GUIDANCE
    - threat_level should be grounded in the situation complexity + exposure + missing critical info (not imagined threats).
    - primary_risk_drivers should explain "why" the threat level is what it is (2–6 bullets).
    - vulnerabilities must be internal/controllable weaknesses, not external threats (2–8 bullets).
    - recommended_mitigations must be specific actions the team can do (2–10 bullets). Each mitigation should include steps.
    - go_no_go should include realistic "go_if" and "no_go_if" conditions.
    - day_of_operator_focus should be a short, practical list of what to pay attention to day-of (3–6 bullets).
    - include a short disclaimer that this is a planning aid and does not replace recon, judgment, or real-time decisions.
    
    STYLE
    - Keep bullets tight and operator-friendly.
    - Avoid long paragraphs.
    - No markdown. No extra keys. No commentary.
    `.trim();

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },

        disclaimer: { type: "string" },

        threat_level: {
          type: "string",
          enum: ["LOW", "MODERATE", "ELEVATED", "HIGH"],
        },

        primary_risk_drivers: {
          type: "array",
          items: { type: "string" },
        },

        planning_confidence: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH"],
        },

        confidence_rationale: {
          type: "string",
        },

        vulnerabilities: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              note: { type: "string" },
            },
            required: ["title", "note"],
          },
        },

        recommended_mitigations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              steps: { type: "string" },
            },
            required: ["title", "steps"],
          },
        },

        go_no_go: {
          type: "object",
          additionalProperties: false,
          properties: {
            go_if: { type: "array", items: { type: "string" } },
            no_go_if: { type: "array", items: { type: "string" } },
          },
          required: ["go_if", "no_go_if"],
        },

        day_of_operator_focus: {
          type: "array",
          items: { type: "string" },
        },

        missing_info_questions: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "summary",
        "disclaimer",
        "threat_level",
        "primary_risk_drivers",
        "planning_confidence",
        "confidence_rationale",
        "vulnerabilities",
        "recommended_mitigations",
        "go_no_go",
        "day_of_operator_focus",
        "missing_info_questions",
      ],
    };

    const body = {
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Pocket Advance:\n${JSON.stringify(inputAdvance, null, 2)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "risk_brief",
          strict: true,
          schema,
        },
      },
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const msg = await resp.text();
      return json(500, { error: msg || "OpenAI request failed" });
    }

    const data = await resp.json();

    const outputText: string =
      data?.output_text ||
      data?.output?.[0]?.content?.find((c: any) => c?.type === "output_text")
        ?.text ||
      "";

    let briefParsed: any = {};
    try {
      briefParsed = JSON.parse(outputText);
    } catch {
      briefParsed = {};
    }

    return json(200, coerceRiskBrief(briefParsed));
  } catch (err: any) {
    return json(500, { error: err?.message || "Unhandled server error" });
  }
};
