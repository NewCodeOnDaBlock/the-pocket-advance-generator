import type { Handler } from "@netlify/functions";

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key)
      return json(500, { error: "Missing GOOGLE_MAPS_API_KEY env var" });

    const q = (event.queryStringParameters?.q || "").trim();
    if (!q) return json(200, []);

    const url =
      "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
      `?input=${encodeURIComponent(q)}` +
      `&types=establishment|geocode` +
      `&key=${encodeURIComponent(key)}`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return json(400, { error: data.error_message || data.status });
    }

    const suggestions =
      (data.predictions || []).slice(0, 6).map((p: any) => ({
        place_id: p.place_id,
        description: p.description,
      })) || [];

    return json(200, suggestions);
  } catch (e: any) {
    return json(500, { error: e?.message || "server error" });
  }
};
