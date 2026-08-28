import { XMLParser } from "fast-xml-parser";

import {
  MAX_ITEMS_PER_TAB,
  REVALIDATE_SECONDS,
  TABS,
  type FeedSource,
  type FeedsResponse,
  type NewsItem,
  type TabPayload,
} from "@/lib/feeds";

export const dynamic = "force-dynamic";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // Ajax Showtime dubbel-encodeert: &#039; in plaats van een apostrof.
  htmlEntities: true,
});

// Sommige uitgevers weigeren requests zonder herkenbare user agent.
const USER_AGENT =
  "Mozilla/5.0 (compatible; AjaxNewsReader/1.0; persoonlijke RSS-lezer)";

type XmlNode = Record<string, unknown>;

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && "#text" in value) {
    const inner = (value as XmlNode)["#text"];
    return inner == null ? "" : String(inner);
  }
  return "";
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

/**
 * Alleen http(s) doorlaten. Feeds zijn externe input, en een `javascript:`-link
 * in een <a href> zou anders zo in de pagina belanden.
 */
function safeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function firstUrlAttribute(value: unknown): string | null {
  for (const node of asArray(value)) {
    if (node && typeof node === "object") {
      const url = (node as XmlNode)["@_url"];
      if (typeof url === "string" && url.trim()) return url.trim();
    }
  }
  return null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNewsItem(node: XmlNode, source: FeedSource): NewsItem | null {
  const link = safeUrl(text(node.link));
  if (!link) return null;

  const title = text(node.title).trim() || "Zonder titel";
  const desc = stripTags(text(node.description));
  const pubDate = text(node.pubDate).trim();
  const parsedDate = Date.parse(pubDate);
  const time = Number.isNaN(parsedDate) ? 0 : parsedDate;

  // VI, AS en Telegraaf leveren <enclosure>; AD levert <media:content>.
  const rawImg =
    firstUrlAttribute(node.enclosure) ??
    firstUrlAttribute(node["media:content"]);

  // Telegraaf: <premium>true</premium>. AD: <dpp:paid>true</dpp:paid>.
  const paidFlag = text(node.premium) || text(node["dpp:paid"]);

  return {
    guid: `${source.id}:${text(node.guid).trim() || link}`,
    title,
    link,
    desc,
    pubDate,
    time,
    imgUrl: rawImg ? safeUrl(rawImg) : null,
    isPaywalled: paidFlag.toLowerCase() === "true",
    sourceId: source.id,
    sourceLabel: source.label,
  };
}

async function fetchFeed(source: FeedSource): Promise<NewsItem[]> {
  // Server-side fetch: geen CORS, dus geen proxies nodig.
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml",
    },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`${source.id}: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml) as XmlNode;
  const channel = (parsed.rss as XmlNode | undefined)?.channel as
    | XmlNode
    | undefined;
  const rawItems = asArray(channel?.item);

  if (rawItems.length === 0) {
    throw new Error(`${source.id}: geen items in de feed`);
  }

  return rawItems
    .filter((node): node is XmlNode => !!node && typeof node === "object")
    .map((node) => toNewsItem(node, source))
    .filter((item): item is NewsItem => item !== null);
}

function matchesFilter(item: NewsItem, needle: string): boolean {
  return `${item.title} ${item.desc}`.toLowerCase().includes(needle);
}

async function buildTab(tab: (typeof TABS)[number]): Promise<TabPayload> {
  const results = await Promise.allSettled(tab.feeds.map(fetchFeed));

  const items: NewsItem[] = [];
  const failed: string[] = [];

  results.forEach((result, index) => {
    const feed = tab.feeds[index];
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      failed.push(feed.label);
      console.warn(`Feed mislukt: ${feed.id}`, result.reason);
    }
  });

  const filtered = tab.filter
    ? items.filter((item) => matchesFilter(item, tab.filter as string))
    : items;

  filtered.sort((a, b) => b.time - a.time);

  return {
    id: tab.id,
    items: filtered.slice(0, MAX_ITEMS_PER_TAB),
    failed,
  };
}

export async function GET(): Promise<Response> {
  const tabs = await Promise.all(TABS.map(buildTab));

  const payload: FeedsResponse = {
    tabs,
    fetchedAt: new Date().toISOString(),
  };

  return Response.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
