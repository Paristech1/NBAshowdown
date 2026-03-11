/**
 * Fetch daily deck from API.
 * Validates response is JSON (not HTML) before parsing.
 */

export async function fetchDailyDeck(apiUrl) {
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    throw new Error('Invalid response: server returned HTML instead of JSON. Check that the API URL is correct.');
  }
  return JSON.parse(text);
}
