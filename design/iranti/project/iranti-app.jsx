const { useState, useMemo, useEffect, useRef } = React;

// Tweakable defaults — host can rewrite this JSON block on disk.
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "showCollage": true,
  "collageOpacity": 20,
  "headlineSize": 104,
  "tileColumns": 4,
  "showCuriosity": true,
  "showPromptPills": true,
  "categoryStyle": "pill"
} /*EDITMODE-END*/;

/* ── small inline icons ── */
const Icon = {
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>,
  globe: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>,
  send: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M5 12l14-7-7 14-2-5-5-2z" strokeLinejoin="round" /></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" strokeLinecap="round" /></svg>,
  spark: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" strokeLinecap="round" /></svg>
};

/* ── topbar ── */
function TopBar({ theme, onToggleTheme }) {
  const isDark = theme === "dark";
  return (
    <div className="topbar">
      <button className="menu-btn" aria-label="Menu"><span></span></button>
      <div className="topbar-right">
        <div className="museum-mark">
          <span className="dot"></span>
          <span>Yemisi Shyllon Museum of Art</span>
        </div>
        <button className="theme-toggle" onClick={onToggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Light mode" : "Dark mode"}>
          {isDark ?
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
            </svg> :

          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />
            </svg>
          }
        </button>
      </div>
    </div>);

}

/* ── collage backdrop ── */
function Collage({ visible, opacity }) {
  if (!visible) return null;
  // 16 tiles, drawn from museum sources for visual rhythm only.
  const sources = [
  ...IRANTI_WORKS.bronze, ...IRANTI_WORKS.mask, ...IRANTI_WORKS.terracotta,
  ...IRANTI_WORKS.textile, ...IRANTI_WORKS.sacred].
  slice(0, 16);
  // hand-tuned grid spans for an asymmetric collage feel
  const spans = [
  { c: "span 2", r: "span 2" }, { c: "span 1", r: "span 1" }, { c: "span 2", r: "span 2" }, { c: "span 1", r: "span 1" },
  { c: "span 1", r: "span 2" }, { c: "span 1", r: "span 1" }, { c: "span 2", r: "span 1" }, { c: "span 1", r: "span 1" },
  { c: "span 1", r: "span 1" }, { c: "span 2", r: "span 1" }, { c: "span 1", r: "span 2" }, { c: "span 2", r: "span 2" },
  { c: "span 1", r: "span 1" }, { c: "span 1", r: "span 1" }, { c: "span 2", r: "span 1" }, { c: "span 1", r: "span 1" }];

  return (
    <div className="collage" aria-hidden="true">
      <div className="collage-grid" style={{ opacity: opacity / 100 }}>
        {sources.map((s, i) =>
        <div key={i} className="collage-tile"
        style={{
          gridColumn: spans[i]?.c, gridRow: spans[i]?.r,
          backgroundImage: s.img ? `url(${s.img})` : "none"
        }} />
        )}
      </div>
      <div className="collage-fade"></div>
    </div>);

}

/* ── hero ── */
function Hero({ headlineSize, onPromptClick, showPromptPills }) {
  const [value, setValue] = useState("");
  const taRef = useRef(null);

  // auto-grow textarea
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + "px";
  }, [value]);

  return (
    <section className="hero">
      <div className="hero-eyebrow">Iranti · Memory of the Collection</div>
      <h1 style={{ fontSize: `${headlineSize}px` }}>Iranti</h1>
      <div className="hero-tagline">Reconnect with your Ayanmò</div>
      <div className="hero-sub">
        I hold what our records carry about the works here — their origins, their makers, their journeys to this place.
      </div>

      <div className="input-wrap">
        <textarea
          ref={taRef}
          className="input-field"
          placeholder="Ask about any artwork, artist, or tradition in our collection…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={1} />
        
        <div className="input-row" style={{ borderColor: "rgb(31, 24, 18)" }}>
          <div className="input-tools">
            <button className="tool tool-pill"><Icon.plus /> Add context</button>
            <button className="tool"><Icon.search /> Search collection</button>
            <button className="tool"><Icon.globe /> English</button>
          </div>
          <button className="send-btn" aria-label="Ask Iranti"><Icon.send /></button>
        </div>
      </div>

      {showPromptPills &&
      <div className="prompt-pills">
          {IRANTI_PROMPT_PILLS.map((p, i) => {
          const obj = typeof p === "string" ? { text: p } : p;
          return (
            <button key={i} className="prompt-pill" onClick={() => onPromptClick?.(obj.text)}>
                {obj.text}{obj.arrow && <span className="arrow"> →</span>}
              </button>);

        })}
        </div>
      }
    </section>);

}

/* ── browse: tabs + grid ── */
function Browse({ tileColumns }) {
  const [active, setActive] = useState("all");
  const works = IRANTI_WORKS[active] || [];

  return (
    <section className="browse">
      <div className="browse-rule">
        <div className="line"></div>
        <div className="label"><span className="star">✦</span> Or wander the collection</div>
        <div className="line"></div>
      </div>

      <div className="browse-head">
        <div className="browse-title">
          What is <em>kept</em> here.
        </div>
        <div className="browse-sub">
          Eight rooms of the catalogue. Choose one and the works will arrange themselves —
          or ask Iranti and the right one will arrive.
        </div>
      </div>

      <div className="cat-tabs" role="tablist">
        {IRANTI_CATEGORIES.map((c, i) =>
        <React.Fragment key={c.id}>
            <button
            className={"cat-tab" + (active === c.id ? " active" : "")}
            onClick={() => setActive(c.id)}
            role="tab"
            aria-selected={active === c.id}>
            
              {c.label}
              <span className="count">{c.count}</span>
            </button>
            {i === 0 && <div className="cat-divider"></div>}
          </React.Fragment>
        )}
      </div>

      <div className="tile-grid" style={{ gridTemplateColumns: `repeat(${tileColumns}, 1fr)` }}>
        {works.map((w) => <Tile key={w.id} work={w} />)}
      </div>
    </section>);

}

function Tile({ work }) {
  const cls = "tile" + (work.span === "feature" ? " feature" : work.span === "wide" ? " wide" : "");
  const hasImg = !!work.img;
  return (
    <article className={cls}>
      <div className={"tile-img" + (hasImg ? "" : " placeholder")}
      style={hasImg ? { backgroundImage: `url(${work.img})` } : null}>
        {!hasImg && <span>{(work.tag || "Artwork").toUpperCase()}</span>}
        {work.tag && hasImg && <span className="tile-tag">{work.tag}</span>}
      </div>
      <div className="tile-meta">
        <div className="tile-title">{work.title}</div>
        <div className="tile-sub">{work.maker} · {work.date}</div>
        <div className="tile-foot">
          <span>View</span>
          <span className="ask"><span className="ar">Ask Iranti</span> →</span>
        </div>
      </div>
    </article>);

}

/* ── curiosity row ── */
function Curiosity() {
  return (
    <section className="curiosity">
      <div className="cur-label">Questions you<br />didn’t know<br />you had</div>
      <div className="cur-questions">
        {IRANTI_CURIOSITY.map((q, i) =>
        <div key={i} className="cur-q">
            <span className="cur-q-text">{q}</span>
            <span className="cur-q-arrow">→</span>
          </div>
        )}
      </div>
    </section>);

}

function FootHint() {
  return (
    <div className="foothint">
      <span className="bar"></span>
      <span>Iranti remembers · It does not declare</span>
      <span className="bar"></span>
    </div>);

}

/* ── main app ── */
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [pendingPrompt, setPendingPrompt] = useState(null);

  // Apply theme to html element + persist locally so refresh keeps it
  useEffect(() => {
    const stored = localStorage.getItem("iranti-theme");
    const initial = stored || tweaks.theme || "light";
    document.documentElement.setAttribute("data-theme", initial);
    if (stored && stored !== tweaks.theme) setTweak("theme", stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme || "light");
    localStorage.setItem("iranti-theme", tweaks.theme || "light");
  }, [tweaks.theme]);

  const toggleTheme = () => setTweak("theme", tweaks.theme === "dark" ? "light" : "dark");

  return (
    <div className="page">
      <Collage visible={tweaks.showCollage} opacity={tweaks.collageOpacity} />
      <TopBar theme={tweaks.theme} onToggleTheme={toggleTheme} />
      <main className="main">
        <Hero
          headlineSize={tweaks.headlineSize}
          onPromptClick={setPendingPrompt}
          showPromptPills={tweaks.showPromptPills} />
        
        <Browse tileColumns={tweaks.tileColumns} />
        {tweaks.showCuriosity && <Curiosity />}
        <FootHint />
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakRadio label="Mode" options={["light", "dark"]}
          value={tweaks.theme}
          onChange={(v) => setTweak("theme", v)} />
        </TweakSection>
        <TweakSection title="Backdrop">
          <TweakToggle label="Show collage backdrop"
          value={tweaks.showCollage}
          onChange={(v) => setTweak("showCollage", v)} />
          <TweakSlider label="Collage opacity" min={0} max={40} step={1}
          value={tweaks.collageOpacity}
          onChange={(v) => setTweak("collageOpacity", v)} />
        </TweakSection>
        <TweakSection title="Hero">
          <TweakSlider label="Headline size" min={64} max={140} step={2}
          value={tweaks.headlineSize}
          onChange={(v) => setTweak("headlineSize", v)} />
          <TweakToggle label="Show prompt pills"
          value={tweaks.showPromptPills}
          onChange={(v) => setTweak("showPromptPills", v)} />
        </TweakSection>
        <TweakSection title="Browse">
          <TweakRadio label="Tile columns" options={[3, 4, 5]}
          value={tweaks.tileColumns}
          onChange={(v) => setTweak("tileColumns", v)} />
          <TweakToggle label="Show curiosity questions"
          value={tweaks.showCuriosity}
          onChange={(v) => setTweak("showCuriosity", v)} />
        </TweakSection>
      </TweaksPanel>
    </div>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);