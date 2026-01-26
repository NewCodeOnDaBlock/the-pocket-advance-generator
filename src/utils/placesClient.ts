export type PlaceSuggestion = {
  place_id: string;
  description: string;
};

export type PlaceDetails = {
  place_id: string;
  name: string;
  formatted_address: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
};

export async function placesAutocomplete(
  q: string
): Promise<PlaceSuggestion[]> {
  const resp = await fetch(
    `/.netlify/functions/places-autocomplete?q=${encodeURIComponent(q)}`
  );
  if (!resp.ok) throw new Error(await resp.text());
  return (await resp.json()) as PlaceSuggestion[];
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const resp = await fetch(
    `/.netlify/functions/place-details?placeId=${encodeURIComponent(placeId)}`
  );
  if (!resp.ok) throw new Error(await resp.text());
  return (await resp.json()) as PlaceDetails;
}
