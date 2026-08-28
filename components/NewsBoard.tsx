"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  BASE_TITLE,
  HIGHLIGHT_MS,
  REFRESH_MS,
  TABS,
  type FeedsResponse,
  type NewsItem,
} from "@/lib/feeds";
import { loadSeen, markSeen, type SeenState } from "@/lib/storage";
import { timeAgo } from "@/lib/timeAgo";

type TabView = {
  items: NewsItem[];
  failed: string[];
  loaded: boolean;
  /** Ongelezen items die nú in de lijst staan; voedt de badge. */
  unseen: Set<string>;
  /** Items die geel oplichten; fade start zodra je de tab opent. */
  highlight: Set<string>;
};

function emptyView(): TabView {
  return {
    items: [],
    failed: [],
    loaded: false,
    unseen: new Set(),
    highlight: new Set(),
  };
}

function initialViews(): Record<string, TabView> {
  return Object.fromEntries(TABS.map((tab) => [tab.id, emptyView()]));
}

export default function NewsBoard() {
  const [views, setViews] = useState<Record<string, TabView>>(initialViews);
  const [activeTabId, setActiveTabId] = useState<string>(TABS[0].id);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const seenRef = useRef<Record<string, SeenState>>({});
  const knownRef = useRef<Record<string, Set<string>>>({});
  const viewsRef = useRef(views);
  const activeRef = useRef(activeTabId);
  const soundRef = useRef(soundEnabled);
  const audioRef = useRef<AudioContext | null>(null);
  const fadeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    viewsRef.current = views;
  }, [views]);

  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);

  const playChime = useCallback(() => {
    if (!soundRef.current) return;
    try {
      const ctx =
        audioRef.current ??
        (audioRef.current = new (
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )());
      const now = ctx.currentTime;
      // Twee korte, oplopende tonen als meldingsgeluid.
      [880, 1175].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + index * 0.14;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch {
      // Web Audio niet beschikbaar of geblokkeerd; geen geluid, verder niets aan de hand.
    }
  }, []);

  const scheduleFade = useCallback((tabId: string) => {
    clearTimeout(fadeTimers.current[tabId]);
    fadeTimers.current[tabId] = setTimeout(() => {
      setViews((prev) => {
        const view = prev[tabId];
        if (!view || view.highlight.size === 0) return prev;
        return { ...prev, [tabId]: { ...view, highlight: new Set() } };
      });
    }, HIGHLIGHT_MS);
  }, []);

  const load = useCallback(async () => {
    let payload: FeedsResponse;
    try {
      const response = await fetch("/api/feeds", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = (await response.json()) as FeedsResponse;
    } catch (error) {
      console.warn("Kon /api/feeds niet laden", error);
      setLoadFailed(true);
      return;
    }

    setLoadFailed(false);
    setFetchedAt(new Date(payload.fetchedAt));

    const active = activeRef.current;
    const next: Record<string, TabView> = {};
    let arrivals = 0;

    for (const tab of payload.tabs) {
      const seen = seenRef.current[tab.id];
      const known = knownRef.current[tab.id];
      if (!seen || !known) continue;

      const guids = tab.items.map((item) => item.guid);
      let unseen: Set<string>;

      if (!seen.initialized) {
        // Allereerste lading is de nulmeting: alles stilzwijgend als gezien wegschrijven.
        markSeen(tab.id, seen, guids);
        seen.initialized = true;
        guids.forEach((guid) => known.add(guid));
        unseen = new Set();
      } else {
        // Net binnengekomen sinds de vorige ronde; bepaalt of het geluid afgaat.
        for (const guid of guids) {
          if (!known.has(guid)) {
            arrivals += 1;
            known.add(guid);
          }
        }
        unseen = new Set(guids.filter((guid) => !seen.set.has(guid)));
      }

      let highlight = new Set<string>();
      if (tab.id === active) {
        // De tab die je op dit moment aankijkt is per definitie gezien.
        highlight = unseen;
        markSeen(tab.id, seen, guids);
        unseen = new Set();
      }

      next[tab.id] = {
        items: tab.items,
        failed: tab.failed,
        loaded: true,
        unseen,
        highlight,
      };
    }

    setViews(next);
    scheduleFade(active);
    if (arrivals > 0) playChime(); // maximaal één chime per ronde
  }, [playChime, scheduleFade]);

  useEffect(() => {
    for (const tab of TABS) {
      const seen = loadSeen(tab.id);
      seenRef.current[tab.id] = seen;
      knownRef.current[tab.id] = new Set(seen.order);
    }

    void load();
    const interval = setInterval(() => void load(), REFRESH_MS);
    const timers = fadeTimers.current;

    return () => {
      clearInterval(interval);
      Object.values(timers).forEach(clearTimeout);
    };
  }, [load]);

  useEffect(() => {
    const total = Object.values(views).reduce(
      (sum, view) => sum + view.unseen.size,
      0,
    );
    document.title = total > 0 ? `(${total}) ${BASE_TITLE}` : BASE_TITLE;
  }, [views]);

  function activateTab(tabId: string) {
    activeRef.current = tabId;
    setActiveTabId(tabId);

    const view = viewsRef.current[tabId];
    const seen = seenRef.current[tabId];
    if (!view || !seen) return;

    // Openen = gezien. De gele markering blijft nog even staan zodat je ziet wát er nieuw was.
    markSeen(
      tabId,
      seen,
      view.items.map((item) => item.guid),
    );
    setViews((prev) => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        highlight: prev[tabId].unseen,
        unseen: new Set(),
      },
    }));
    scheduleFade(tabId);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundRef.current = next;
    if (!next) return;

    // AudioContext moet gestart worden na een gebruikersactie (browserbeleid).
    audioRef.current ??= new (
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
    if (audioRef.current.state === "suspended") void audioRef.current.resume();
    playChime(); // korte test-ping
  }

  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];
  const activeView = views[activeTab.id] ?? emptyView();

  let metaText = "Laatste update: —";
  if (fetchedAt) {
    metaText = `Laatste update: ${fetchedAt.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    if (activeView.failed.length > 0) {
      // Stil doorgaan met wat er wel is; alleen een discrete melding.
      metaText += ` (${activeView.failed.join(", ")} niet bereikbaar)`;
    }
  }

  return (
    <main>
      <nav className="tabs" role="tablist">
        {TABS.map((tab) => {
          const count = views[tab.id]?.unseen.size ?? 0;
          const isActive = tab.id === activeTab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`tab-btn${isActive ? " active" : ""}`}
              onClick={() => activateTab(tab.id)}
            >
              <span>{tab.label}</span>
              {count > 0 && <span className="tab-badge">{count}</span>}
            </button>
          );
        })}
      </nav>

      <div className="toolbar">
        <button
          type="button"
          className={`sound-toggle${soundEnabled ? " on" : ""}`}
          onClick={toggleSound}
        >
          {soundEnabled ? "🔔 Geluid aan" : "🔕 Geluid uit"}
        </button>
        <div className="meta">{metaText}</div>
      </div>

      <div role="tabpanel">
        {!activeView.loaded && !loadFailed && (
          <div className="status">Nieuws laden…</div>
        )}

        {loadFailed && !activeView.loaded && (
          <div className="status error">
            Kon het nieuws niet laden. Probeer de pagina opnieuw te laden.
          </div>
        )}

        {activeView.loaded && activeView.items.length === 0 && (
          <div
            className={`status${
              activeView.failed.length === activeTab.feeds.length
                ? " error"
                : ""
            }`}
          >
            {activeView.failed.length === activeTab.feeds.length
              ? "Beide bronnen zijn nu niet bereikbaar."
              : "Geen Ajax-berichten in deze feeds op dit moment."}
          </div>
        )}

        {activeView.items.length > 0 && (
          <ul className="items">
            {activeView.items.map((item) => (
              <li
                key={item.guid}
                className={`item${activeView.highlight.has(item.guid) ? " is-new" : ""}`}
              >
                {item.imgUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.imgUrl} alt="" loading="lazy" />
                )}
                <div className="body">
                  <a
                    className="title"
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.title}
                  </a>
                  <p className="desc">{item.desc}</p>
                  <div className="meta-row">
                    <span className={`source-badge ${item.sourceId}`}>
                      {item.sourceLabel}
                    </span>
                    <time dateTime={item.pubDate}>{timeAgo(item.pubDate)}</time>
                    {item.isPaywalled && (
                      <span
                        className="paywall-badge"
                        title="Artikel achter een betaalmuur"
                      >
                        🔒 Betaald
                      </span>
                    )}
                    {activeView.highlight.has(item.guid) && (
                      <span className="new-badge">Nieuw</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
