export type FeedSource = {
  id: string;
  label: string;
  url: string;
};

export type TabConfig = {
  id: string;
  label: string;
  /** Zoekterm waarop de items van deze tab gefilterd worden. `null` = alles tonen. */
  filter: string | null;
  feeds: FeedSource[];
};

export type NewsItem = {
  guid: string;
  title: string;
  link: string;
  desc: string;
  pubDate: string;
  time: number;
  imgUrl: string | null;
  isPaywalled: boolean;
  sourceId: string;
  sourceLabel: string;
};

export type TabPayload = {
  id: string;
  items: NewsItem[];
  /** Labels van bronnen die deze ronde niet bereikbaar waren. */
  failed: string[];
};

export type FeedsResponse = {
  tabs: TabPayload[];
  fetchedAt: string;
};

export const TABS: TabConfig[] = [
  {
    id: "ajax",
    label: "Ajax",
    filter: null, // deze bronnen gaan sowieso alleen over Ajax
    feeds: [
      {
        id: "vi",
        label: "VI",
        url: "https://www.vi.nl/feed/news.xml?tag=ajax",
      },
      {
        id: "as",
        label: "AS",
        url: "https://www.ajaxshowtime.com/sitemap/news.xml",
      },
    ],
  },
  {
    id: "voetbal",
    label: "Voetbalnieuws",
    filter: "ajax", // brede voetbalfeeds, dus filteren
    feeds: [
      {
        id: "tg",
        label: "TG",
        url: "https://www.telegraaf.nl/sport/voetbal/rss",
      },
      { id: "ad", label: "AD", url: "https://www.ad.nl/voetbal/rss.xml" },
    ],
  },
];

/** Hoeveel items een tab maximaal teruggeeft. Ajax Showtime levert er bijna 500. */
export const MAX_ITEMS_PER_TAB = 60;

/** Hoe lang de server een feed-respons hergebruikt, in seconden. */
export const REVALIDATE_SECONDS = 300;

/** Hoe vaak de client zijn eigen endpoint opnieuw bevraagt, in milliseconden. */
export const REFRESH_MS = 10 * 60 * 1000;

/** Hoe lang de gele markering blijft staan nadat je een tab opent. */
export const HIGHLIGHT_MS = 8000;

/** Aantal GUIDs dat per tab onthouden wordt als "al gezien". */
export const MAX_SEEN = 200;

export const STORAGE_PREFIX = "ajaxNews:v1:";
export const BASE_TITLE = "Ajax Nieuws";
