import type { Handler } from "@netlify/functions";

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function pickComponent(components: any[], type: string) {
  const c = components?.find((x) => (x.types || []).includes(type));
  return c?.long_name || "";
}

export const handler: Handler = async (event) => {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key)
      return json(500, { error: "Missing GOOGLE_MAPS_API_KEY env var" });

    const placeId = (event.queryStringParameters?.placeId || "").trim();
    if (!placeId) return json(400, { error: "Missing placeId" });

    const url =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=name,formatted_address,geometry,address_component,place_id` +
      `&key=${encodeURIComponent(key)}`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status !== "OK") {
      return json(400, { error: data.error_message || data.status });
    }

    const r = data.result;
    const comps = r.address_components || [];

    const out = {
      place_id: r.place_id,
      name: r.name || "",
      formatted_address: r.formatted_address || "",
      city:
        pickComponent(comps, "locality") || pickComponent(comps, "sublocality"),
      state: pickComponent(comps, "administrative_area_level_1"),
      country: pickComponent(comps, "country"),
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
    };

    return json(200, out);
  } catch (e: any) {
    return json(500, { error: e?.message || "server error" });
  }
};
