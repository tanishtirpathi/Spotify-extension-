(() => {
  const $ = (s) => document.querySelector(s);
  const SEL = {
    title: '[data-testid="context-item-link"]',
    artist: '[data-testid="context-item-info-artist"]',
    cover: '[data-testid="cover-art-image"]',
    pos: '[data-testid="playback-position"]',
    dur: '[data-testid="playback-duration"]',
    play: '[data-testid="control-button-playpause"]',
  };
  const LYRIC_OFFSET = 0.25; // seconds, tweak if lyrics feel early/late

  // ---------- overlay DOM ----------
  const root = document.createElement("div");
  root.id = "sil-root";
  root.innerHTML = `
    <div class="sil-bg"></div>
    <button class="sil-close" title="Close (Esc)">✕</button>
    <div class="sil-stage">
      <section class="sil-left">
        <img class="sil-art" alt="">
        <h1 class="sil-title"></h1>
        <p class="sil-artist"></p>
      </section>
      <section class="sil-right"><div class="sil-lyrics"></div></section>
    </div>`;
  document.body.appendChild(root);

  const toggle = document.createElement("button");
  toggle.id = "sil-toggle";
  toggle.textContent = "Immersive";
  toggle.title = "Full-screen lyrics view (Alt+L)";
  document.body.appendChild(toggle);

  const el = {
    bg: root.querySelector(".sil-bg"),
    art: root.querySelector(".sil-art"),
    title: root.querySelector(".sil-title"),
    artist: root.querySelector(".sil-artist"),
    lyrics: root.querySelector(".sil-lyrics"),
  };

  // ---------- open / close ----------
  async function open() {
    root.classList.add("open");
    try { await root.requestFullscreen(); } catch (_) {}
    refreshTrack(true);
  }
  function close() {
    root.classList.remove("open");
    if (document.fullscreenElement) document.exitFullscreen();
  }
  toggle.onclick = () => (root.classList.contains("open") ? close() : open());
  root.querySelector(".sil-close").onclick = close;
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) root.classList.remove("open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      toggle.click();
    }
  });

  // ---------- playback state ----------
  const toSec = (t) => {
    if (!t) return 0;
    const p = t.trim().split(":").map(Number);
    return p.reduce((a, n) => a * 60 + n, 0);
  };
  let lastText = "", lastChange = performance.now(), basePos = 0;
  function currentTime() {
    const t = $(SEL.pos)?.textContent || "0:00";
    if (t !== lastText) {
      lastText = t;
      basePos = toSec(t);
      lastChange = performance.now();
    }
    const playing = $(SEL.play)?.getAttribute("aria-label")?.toLowerCase().includes("pause");
    // Spotify only shows whole seconds, so interpolate between ticks
    return basePos + (playing ? Math.min((performance.now() - lastChange) / 1000, 1) : 0);
  }

  // ---------- track + lyrics ----------
  let trackKey = "", lines = [], activeIdx = -1;

  function highResCover() {
    const img = $(SEL.cover) || $('[data-testid="now-playing-widget"] img');
    const src = img?.currentSrc || img?.src || "";
    // swap the small thumbnail id (8 hex chars) for the 640px one
    return src.replace(/ab67616d[0-9a-f]{8}/, "ab67616d0000b273");
  }

  async function refreshTrack(force) {
    const title = $(SEL.title)?.textContent?.trim();
    const artist = $(SEL.artist)?.textContent?.trim();
    if (!title) return;
    const key = title + "|" + artist;
    if (key === trackKey && !force) return;
    trackKey = key;

    el.title.textContent = title;
    el.artist.textContent = artist || "";
    const cover = highResCover();
    if (cover) {
      const fallback = ($(SEL.cover) || $('[data-testid="now-playing-widget"] img'))?.src || "";
      el.art.onerror = () => { if (fallback && el.art.src !== fallback) el.art.src = fallback; };
      el.art.src = cover;
      applyColors(cover);
    }
    showMessage("Finding lyrics…");

    // give Spotify a moment to update its own track link
    await new Promise((r) => setTimeout(r, 350));
    if (key !== trackKey) return;

    const duration = toSec($(SEL.dur)?.textContent);
    const result = await loadLyrics({ title, artist, duration });
    if (key !== trackKey) return; // song changed while loading

    if (result?.synced?.length) {
      lines = result.synced;
      renderLines(lines.map((l) => l.text));
      el.lyrics.classList.remove("plain");
    } else if (result?.plain) {
      lines = [];
      renderLines(result.plain.split("\n"));
      el.lyrics.classList.add("plain");
    } else {
      lines = [];
      showMessage("No lyrics found for this song");
      el.lyrics.classList.remove("plain");
    }
  }

  // Spotify's own lyrics first (via the page), LRCLIB as backup
  function askPage(payload) {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      const done = (v) => { window.removeEventListener("message", h); clearTimeout(to); resolve(v); };
      const h = (e) => {
        if (e.source === window && e.data?.sil === "lyrics-res" && e.data.id === id) done(e.data.result);
      };
      const to = setTimeout(() => done(null), 15000);
      window.addEventListener("message", h);
      window.postMessage({ sil: "lyrics-req", id, ...payload }, "*");
    });
  }

  function findTrackId() {
    const links = document.querySelectorAll('[data-testid="now-playing-widget"] a[href*="/track/"], ' + SEL.title);
    for (const a of links) {
      const m = a.getAttribute("href")?.match(/\/track\/([A-Za-z0-9]{22})/);
      if (m) return m[1];
    }
    return null;
  }

  async function loadLyrics(info) {
    const spot = await askPage({ trackId: findTrackId(), title: info.title, artist: info.artist });
    if (spot?.synced?.length || spot?.plain) return spot;
    const res = await new Promise((r) => chrome.runtime.sendMessage({ type: "lyrics", ...info }, r));
    if (res?.syncedLyrics) return { synced: parseLRC(res.syncedLyrics) };
    if (res?.plainLyrics) return { plain: res.plainLyrics };
    return null;
  }

  function parseLRC(lrc) {
    const out = [];
    for (const raw of lrc.split("\n")) {
      const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if (m) out.push({ t: +m[1] * 60 + +m[2], text: m[3].trim() });
    }
    return out;
  }

  function showMessage(msg) {
    activeIdx = -1;
    el.lyrics.innerHTML = `<p class="sil-msg">${msg}</p>`;
  }

  function renderLines(texts) {
    activeIdx = -1;
    el.lyrics.innerHTML = "";
    texts.forEach((t, i) => {
      const p = document.createElement("p");
      p.className = "sil-line";
      p.textContent = t || "♪";
      if (!t) p.classList.add("gap");
      p.onclick = () => seekTo(lines[i]?.t);
      el.lyrics.appendChild(p);
    });
  }

  // Click a line to seek by clicking on Spotify's own progress bar
  function seekTo(sec) {
    if (sec == null) return;
    const bar = $('[data-testid="playback-progressbar"]');
    const dur = toSec($(SEL.dur)?.textContent);
    if (!bar || !dur) return;
    const r = bar.getBoundingClientRect();
    const x = r.left + (sec / dur) * r.width, y = r.top + r.height / 2;
    ["mousedown", "mouseup", "click"].forEach((type) =>
      bar.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }))
    );
  }

  // ---------- sync loop ----------
  function tick() {
    if (root.classList.contains("open")) {
      refreshTrack(false);
      if (lines.length) {
        const t = currentTime() + LYRIC_OFFSET;
        let idx = -1;
        for (let i = 0; i < lines.length; i++) { if (lines[i].t <= t) idx = i; else break; }
        if (idx !== activeIdx) {
          activeIdx = idx;
          const kids = el.lyrics.children;
          for (let i = 0; i < kids.length; i++) {
            const d = Math.abs(i - idx);
            kids[i].classList.toggle("active", i === idx);
            kids[i].classList.toggle("past", i < idx);
            kids[i].style.setProperty("--d", Math.min(d, 6));
          }
          kids[idx]?.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- cover → background colours ----------
  function applyColors(src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, 24, 24);
        const d = ctx.getImageData(0, 0, 24, 24).data;
        // bucket by hue, weight by saturation, so a vivid colour beats flat greys
        const buckets = {};
        for (let i = 0; i < d.length; i += 4) {
          const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
          if (l < 0.12 || l > 0.92) continue;
          const k = Math.round(h / 20);
          const b = (buckets[k] ||= { w: 0, h: 0, s: 0, l: 0 });
          const w = 0.2 + s;
          b.w += w; b.h += h * w; b.s += s * w; b.l += l * w;
        }
        const best = Object.values(buckets).sort((a, b) => b.w - a.w)[0];
        const h = best ? best.h / best.w : 220;
        const s = best ? Math.max(0.45, Math.min(0.85, best.s / best.w)) : 0.3;
        root.style.setProperty("--c1", `hsl(${h} ${s * 100}% 38%)`);
        root.style.setProperty("--c2", `hsl(${(h + 35) % 360} ${s * 100}% 22%)`);
        root.style.setProperty("--c3", `hsl(${(h + 330) % 360} ${s * 90}% 12%)`);
      } catch (_) {
        root.style.setProperty("--c1", "#3a4a6b");
        root.style.setProperty("--c2", "#222c44");
        root.style.setProperty("--c3", "#10131f");
      }
    };
    img.src = src;
  }

  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const dd = max - min;
    const s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
    const h = max === r ? (g - b) / dd + (g < b ? 6 : 0) : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
    return [h * 60, s, l];
  }
})();
