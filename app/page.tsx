import NewsBoard from "@/components/NewsBoard";

export default function Page() {
  return (
    <>
      <header>
        <p className="eyebrow">
          VI &amp; Ajax Showtime · De Telegraaf &amp; AD
        </p>
        <h1>Ajax Nieuws</h1>
        <p>
          Het laatste nieuws over Ajax uit vier bronnen, gesorteerd op tijd.
          Ververst elke 10 minuten.
        </p>
      </header>

      <NewsBoard />

      <footer>
        <span className="sources-label">Bronnen</span>
        <div className="sources">
          <a href="https://www.vi.nl" target="_blank" rel="noopener noreferrer">
            vi.nl
          </a>
          <a
            href="https://www.ajaxshowtime.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            ajaxshowtime.com
          </a>
          <a
            href="https://www.telegraaf.nl/sport/voetbal"
            target="_blank"
            rel="noopener noreferrer"
          >
            telegraaf.nl
          </a>
          <a
            href="https://www.ad.nl/voetbal"
            target="_blank"
            rel="noopener noreferrer"
          >
            ad.nl
          </a>
        </div>
      </footer>
    </>
  );
}
