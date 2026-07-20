export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

// Platform-owned key (Serper), not BYOK — the one external key the app
// itself holds. See DEVELOPMENT_PLAN.md.
export async function webSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error("SERPER_API_KEY is not set");
  }

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Serper search failed with status ${res.status}`);
  }

  const data = await res.json();
  const organic: SerperOrganicResult[] = Array.isArray(data?.organic)
    ? data.organic
    : [];

  return organic.slice(0, 5).map((r) => ({
    title: r.title ?? "",
    link: r.link ?? "",
    snippet: r.snippet ?? "",
  }));
}
