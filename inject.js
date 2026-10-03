// Runs inside the Spotify page itself (MAIN world) so it can reuse Spotify's
// own login token and fetch the same lyrics Spotify shows in its app.
(() => {
  const LOG = (...a) => console.log("[Immersive]", ...a);
  let token = null;
  const origFetch = window.fetch;

  function readAuth(input, init) {
    let h = init && init.headers;
    if (!h && input && typeof input === "object" && input.headers) h = input.headers;
    if (!h) return null;
    if (h instanceof Headers) return h.get("authorization");
    if (Array.isArray(h)) { const p = h.find((x) => String(x[0]).toLowerCase() === "authorization"); return p && p[1]; }
    return h.authorization || h.Authorization || (typeof h.get === "function" ? h.get("authorization") : null);
  }

  function rememberAuth(value) {
    if (value && /^Bearer\s+/i.test(value)) token = value;
  }

  // Remember the bearer token Spotify's own player uses
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input.url;
      if (/spclient\.wg\.spotify\.com|api\.spotify\.com/.test(url)) {
        rememberAuth(readAuth(input, init));
      }
    } catch (_) {}
    return origFetch.apply(this, arguments);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__silUrl = String(url);
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (/authorization/i.test(name) && /spclient\.wg\.spotify\.com|api\.spotify\.com/.test(this.__silUrl || "")) {
      rememberAuth(value);
    }
    return origSetRequestHeader.apply(this, arguments);
  };

  const authHeaders = () => ({ Authorization: token, "app-platform": "WebPlayer", Accept: "application/json" });

  async function findTrackId(title, artist) {
    const q = encodeURIComponent(`${title} ${artist}`);
    const r = await origFetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, { headers: authHeaders() });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.tracks?.items?.[0]?.id || null;
  }

  async function getLyrics({ trackId, title, artist }) {
    // the token appears after the player's first few requests
    for (let i = 0; i < 20 && !token; i++) await new Promise((r) => setTimeout(r, 250));
    if (!token) { LOG("no token captured yet"); return null; }

    let id = trackId;
    if (!id) id = await findTrackId(title, artist);
    if (!id) { LOG("no track id"); return null; }

    const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`;
    const r = await origFetch(url, { headers: authHeaders() });
    LOG("lyrics status", r.status, "for", id);
    if (!r.ok) return null;
    const j = await r.json();
    const lines = j?.lyrics?.lines || [];
    if (!lines.length) return null;
    if (j.lyrics.syncType === "LINE_SYNCED") {
      return { synced: lines.map((l) => ({ t: Number(l.startTimeMs) / 1000, text: l.words })) };
    }
    return { plain: lines.map((l) => l.words).join("\n") };
  }

  window.addEventListener("message", async (e) => {
    if (e.source !== window || e.data?.sil !== "lyrics-req") return;
    let result = null;
    try { result = await getLyrics(e.data); } catch (err) { LOG("error", err); }
    window.postMessage({ sil: "lyrics-res", id: e.data.id, result }, "*");
  });
})();
