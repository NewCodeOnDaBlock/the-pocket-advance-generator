import type { Handler } from "@netlify/functions";

type RiskBrief = {
  summary: string;
  threat_level: "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
  key_risks: Array<{ title: string; why_it_matters: string }>;
  vulnerabilities: Array<{ title: string; note: string }>;
  mitigations: Array<{ title: string; steps: string }>;
  movement_constraints: Array<{ title: string; why: string; action: string }>;
  comms_checks: Array<{ check: string; why: string }>;
  medical_plan: {
    primary: string;
    secondary: string;
    evac_route_notes: string;
  };
  go_no_go: { go_if: string[]; no_go_if: string[] };
  missing_info_questions: string[];
  sources: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
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

function asString(v: any) {
  return typeof v === "string" ? v : "";
}
function asArray(v: any) {
  return Array.isArray(v) ? v : [];
}

function coerce(input: any): RiskBrief {
  const threat: RiskBrief["threat_level"] =
    input?.threat_level === "LOW" ||
    input?.threat_level === "MODERATE" ||
    input?.threat_level === "ELEVATED" ||
    input?.threat_level === "HIGH"
      ? input.threat_level
      : "MODERATE";

  const confidence: RiskBrief["confidence"] =
    input?.confidence === "LOW" ||
    input?.confidence === "MEDIUM" ||
    input?.confidence === "HIGH"
      ? input.confidence
      : "MEDIUM";

  return {
    summary: asString(input?.summary).slice(0, 1200),
    threat_level: threat,
    key_risks: asArray(input?.key_risks)
      .map((x: any) => ({
        title: asString(x?.title).slice(0, 140),
        why_it_matters: asString(x?.why_it_matters).slice(0, 360),
      }))
      .filter((x: any) => x.title.trim())
      .slice(0, 8),
    vulnerabilities: asArray(input?.vulnerabilities)
      .map((x: any) => ({
        title: asString(x?.title).slice(0, 140),
        note: asString(x?.note).slice(0, 360),
      }))
      .filter((x: any) => x.title.trim())
      .slice(0, 8),
    mitigations: asArray(input?.mitigations)
      .map((x: any) => ({
        title: asString(x?.title).slice(0, 140),
        steps: asString(x?.steps).slice(0, 700),
      }))
      .filter((x: any) => x.title.trim())
      .slice(0, 10),

    movement_constraints: asArray(input?.movement_constraints)
      .map((x: any) => ({
        title: asString(x?.title).slice(0, 140),
        why: asString(x?.why).slice(0, 260),
        action: asString(x?.action).slice(0, 260),
      }))
      .filter((x: any) => x.title.trim())
      .slice(0, 8),

    comms_checks: asArray(input?.comms_checks)
      .map((x: any) => ({
        check: asString(x?.check).slice(0, 160),
        why: asString(x?.why).slice(0, 260),
      }))
      .filter((x: any) => x.check.trim())
      .slice(0, 8),

    medical_plan: {
      primary: asString(input?.medical_plan?.primary).slice(0, 220),
      secondary: asString(input?.medical_plan?.secondary).slice(0, 220),
      evac_route_notes: asString(input?.medical_plan?.evac_route_notes).slice(
        0,
        500
      ),
    },

    go_no_go: {
      go_if: asArray(input?.go_no_go?.go_if)
        .map((x: any) => asString(x).slice(0, 220))
        .filter(Boolean)
        .slice(0, 10),
      no_go_if: asArray(input?.go_no_go?.no_go_if)
        .map((x: any) => asString(x).slice(0, 220))
        .filter(Boolean)
        .slice(0, 10),
    },

    missing_info_questions: asArray(input?.missing_info_questions)
      .map((x: any) => asString(x).slice(0, 220))
      .filter(Boolean)
      .slice(0, 12),

    sources: asArray(input?.sources)
      .map((x: any) => asString(x).slice(0, 240))
      .filter(Boolean)
      .slice(0, 12),
    confidence,
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
    if (!apiKey)
      return json(500, { error: "Missing OPENAI_API_KEY env var in Netlify." });

    const parsed = event.body ? JSON.parse(event.body) : {};
    const advance = parsed?.advance ?? {};
    const redactMode = Boolean(parsed?.redactMode);

    const inputAdvance = redactMode ? redactAdvance(advance) : advance;

    const system = `
You are an experienced executive protection advance/operations planner.
Generate a high-value "Risk Brief" that is actionable for a protection team.

Rules:
- Base everything ONLY on the provided Pocket Advance fields. Do not invent facts, stats, or named threats.
- If info is missing, state assumptions as assumptions and add questions in missing_info_questions.
- Use concise, operational language (team brief style).
- Output must be valid JSON matching the provided schema. No markdown. No extra keys.
- Include clear mitigations (steps). Avoid vague advice.
`.trim();

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        threat_level: {
          type: "string",
          enum: ["LOW", "MODERATE", "ELEVATED", "HIGH"],
        },

        key_risks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              why_it_matters: { type: "string" },
            },
            required: ["title", "why_it_matters"],
          },
        },
        vulnerabilities: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { title: { type: "string" }, note: { type: "string" } },
            required: ["title", "note"],
          },
        },
        mitigations: {
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

        movement_constraints: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              why: { type: "string" },
              action: { type: "string" },
            },
            required: ["title", "why", "action"],
          },
        },

        comms_checks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { check: { type: "string" }, why: { type: "string" } },
            required: ["check", "why"],
          },
        },

        medical_plan: {
          type: "object",
          additionalProperties: false,
          properties: {
            primary: { type: "string" },
            secondary: { type: "string" },
            evac_route_notes: { type: "string" },
          },
          required: ["primary", "secondary", "evac_route_notes"],
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

        missing_info_questions: { type: "array", items: { type: "string" } },
        sources: { type: "array", items: { type: "string" } },
        confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
      },
      required: [
        "summary",
        "threat_level",
        "key_risks",
        "vulnerabilities",
        "mitigations",
        "movement_constraints",
        "comms_checks",
        "medical_plan",
        "go_no_go",
        "missing_info_questions",
        "sources",
        "confidence",
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

    const rawText = await resp.text();
    if (!resp.ok)
      return json(500, { error: rawText || "OpenAI request failed" });

    const data = JSON.parse(rawText);

    const outputText: string =
      data?.output_text ||
      data?.output?.[0]?.content?.find((c: any) => c?.type === "output_text")
        ?.text ||
      "";

    let parsedOut: any = {};
    try {
      parsedOut = JSON.parse(outputText);
    } catch {
      parsedOut = {};
    }

    return json(200, coerce(parsedOut));
  } catch (err: any) {
    return json(500, { error: err?.message || "Unhandled server error" });
  }
};
