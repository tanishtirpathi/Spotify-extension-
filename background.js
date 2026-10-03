// Backup lyrics source: LRCLIB (used only if Spotify's own lyrics aren't available).
async function lrclib(title, artist, duration) {
  const p = new URLSearchParams({ track_name: title, artist_name: artist, duration: String(Math.round(duration || 0)) });
  let r = await fetch("https://lrclib.net/api/get?" + p);
  if (r.ok) return r.json();
  r = await fetch("https://lrclib.net/api/search?" + new URLSearchParams({ q: `${title} ${artist}` }));
  const list = r.ok ? await r.json() : [];
  return list.find((x) => x.syncedLyrics) || list[0] || null;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== "lyrics") return;
  (async () => {
    try {
      // try the full title first, then without "- From 'Movie'" / "(feat. ...)" suffixes
      const clean = msg.title.replace(/\s*[-–(\[].*$/, "").trim();
      let res = await lrclib(msg.title, msg.artist, msg.duration);
      if (!res && clean && clean !== msg.title) res = await lrclib(clean, msg.artist, msg.duration);
      reply(res || null);
    } catch (e) {
      reply(null);
    }
  })();
  return true;
});
