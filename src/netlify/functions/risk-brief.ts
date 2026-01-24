import type { Handler } from "@netlify/functions";

// If you're using TS path aliases in your Vite app, DON'T import app files here.
// Keep the function self-contained (Netlify bundles functions separately).

type RiskBrief = {
  summary: string; // 2-4 sentences
  threat_level: "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
  key_risks: Array<{ title: string; why_it_matters: string }>;
  vulnerabilities: Array<{ title: string; note: string }>;
  mitigations: Array<{ title: string; steps: string }>;
  go_no_go: {
    go_if: string[];
    no_go_if: string[];
  };
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
  // Minimal runtime validation + safe defaults to prevent UI breakage.
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
    .filter((x: any) => x.title.trim());

  const vulnerabilities = asArray(input?.vulnerabilities)
    .map((x: any) => ({
      title: asString(x?.title).slice(0, 140),
      note: asString(x?.note).slice(0, 320),
    }))
    .filter((x: any) => x.title.trim());

  const mitigations = asArray(input?.mitigations)
    .map((x: any) => ({
      title: asString(x?.title).slice(0, 140),
      steps: asString(x?.steps).slice(0, 500),
    }))
    .filter((x: any) => x.title.trim());

  const go_if = asArray(input?.go_no_go?.go_if)
    .map((x: any) => asString(x).slice(0, 200))
    .filter((x: string) => x.trim());

  const no_go_if = asArray(input?.go_no_go?.no_go_if)
    .map((x: any) => asString(x).slice(0, 200))
    .filter((x: string) => x.trim());

  const missing_info_questions = asArray(input?.missing_info_questions)
    .map((x: any) => asString(x).slice(0, 220))
    .filter((x: string) => x.trim());

  return {
    summary: asString(input?.summary).slice(0, 800),
    threat_level: threat,
    key_risks: key_risks.slice(0, 6),
    vulnerabilities: vulnerabilities.slice(0, 6),
    mitigations: mitigations.slice(0, 6),
    go_no_go: {
      go_if: go_if.slice(0, 6),
      no_go_if: no_go_if.slice(0, 6),
    },
    missing_info_questions: missing_info_questions.slice(0, 8),
  };
}

function redactAdvance(advance: any) {
  // Optional: your App.tsx already redacts in preview,
  // but you might want to keep *sensitive fields* out of the model prompt too.
  // This is a conservative pass that strips likely sensitive fields.
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
    if (event.httpMethod === "OPTIONS") {
      return json(200, { ok: true });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

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

    // ---- OpenAI request (Responses API) ----
    // Using a strict JSON response format so your UI always receives RiskBrief.
    const system = `
You are an experienced executive protection advance/operations planner.
Create a concise "Risk Brief" for the provided Pocket Advance.

Hard rules:
- Output MUST be valid JSON that matches the schema.
- Keep it practical, non-alarmist, and grounded in the provided info.
- Do NOT invent specific facts (e.g., named threats, exact crime stats, or specific intel).
- Use generic risks when details are missing.
- If info is missing, list questions in missing_info_questions.
- No markdown, no extra keys.
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
            properties: { title: { type: "string" }, steps: { type: "string" } },
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
        missing_info_questions: { type: "array", items: { type: "string" } },
      },
      required: [
        "summary",
        "threat_level",
        "key_risks",
        "vulnerabilities",
        "mitigations",
        "go_no_go",
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

    // The JSON output appears as a string in `output_text` for Responses API.
    const outputText: string =
      data?.output_text ||
      data?.output?.[0]?.content?.find((c: any) => c?.type === "output_text")
        ?.text ||
      "";

    let briefParsed: any;
    try {
      briefParsed = JSON.parse(outputText);
    } catch {
      // Sometimes the output may arrive in `output[0].content[0].text` etc.
      // Fallback: try to find any JSON-looking text.
      briefParsed = {};
    }

    const safeBrief = coerceRiskBrief(briefParsed);

    return json(200, safeBrief);
  } catch (err: any) {
    return json(500, {
      error: err?.message || "Unhandled server error",
    });
  }
};
