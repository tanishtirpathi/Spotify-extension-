# Spotify Immersive Lyrics

Spotify Immersive Lyrics is a lightweight Chrome, Edge, and Brave extension that turns
the Spotify Web Player into a full-screen lyrics experience. It combines synchronized
lyrics, album artwork, cover-matched gradients, playback controls, and a seekable
progress bar in one focused view.

## What it looks like

The immersive view is designed around the currently playing song:

- Album artwork is shown beside the lyrics.
- The background uses the artwork with a soft, blurred gradient.
- Previous, play/pause, and next controls sit below the artwork.
- The progress bar shows elapsed time and total duration and can be dragged.
- Synchronized lyrics scroll into focus as the song plays.
- A styled music illustration appears when lyrics are unavailable.

## Features

- Full-screen lyrics overlay for Spotify Web Player.
- Spotify lyrics lookup with LRCLIB as a backup source.
- Synchronized lyrics with automatic scrolling.
- Plain, unsynchronized lyrics when timestamps are unavailable.
- Click any synchronized lyric line to seek to that moment.
- Previous track, play/pause, and next track controls.
- Custom seek bar with current time and total duration.
- Album-cover background with color extraction and layered gradients.
- Keyboard shortcuts and responsive layout for smaller screens.
- Graceful handling when the extension is reloaded while Spotify is open.

## Requirements

- Google Chrome, Microsoft Edge, or Brave.
- An active internet connection.
- Spotify Web Player at <https://open.spotify.com>.
- A Spotify account that can play music in the Web Player.

## Install from source

This project is currently loaded as an unpacked extension.

1. Download or clone this repository.
2. Open the browser extension manager:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder containing `manifest.json`.
6. Open or refresh <https://open.spotify.com>.
7. Start playing a song.

There is no build step or package installation required.

## Using the immersive player

### Open and close

- Click the **Immersive** button near the bottom-right of Spotify.
- Or press **Alt + L**.
- Press **Esc** or click the close button to exit.

### Playback

The controls below the album artwork are connected to Spotify's native player:

- **Previous**: play the previous track.
- **Play/Pause**: toggle the current track.
- **Next**: play the next track.

### Seek through a song

Use the progress bar below the playback controls:

- Click anywhere on the bar to jump to that position.
- Drag the thumb to scrub through the song.
- The left label shows the current time.
- The right label shows the full track duration.

You can also click a synchronized lyric line to jump directly to its timestamp.

## Lyrics behavior

The extension tries to return lyrics quickly by querying both sources in parallel:

1. Spotify's own lyrics endpoint, when the page session makes it available.
2. LRCLIB as a fallback.

The first valid result is displayed. Depending on the source, lyrics may be:

- **Synchronized**: lines follow the current playback position.
- **Plain**: text is displayed without timestamps.
- **Unavailable**: a styled music illustration is shown instead of a plain error.

Lyrics can be unavailable for songs with uncommon spellings, remixes, movie-version
suffixes, transliterations, or tracks that neither provider has indexed. Playing the
exact album or single version can improve matching.

## Troubleshooting

### The extension context was invalidated

If the browser reports an error similar to:

```text
Extension context invalidated
```

the extension was reloaded or updated while its content script was still running.
This is normal during development. Fix it by:

1. Returning to the extension manager.
2. Clicking **Reload** for Spotify Immersive Lyrics.
3. Refreshing the Spotify tab.
4. Opening Immersive mode again.

The extension also handles this situation gracefully for new lyric requests, but an
already-running content script must still be refreshed after an extension reload.

### The seek bar does not move the song

1. Make sure Spotify is actively playing a track.
2. Reload the extension and refresh the Spotify tab.
3. Open Immersive mode again.
4. Try clicking the bar rather than dragging first.

Spotify can change its Web Player markup, so a browser update or Spotify UI update may
temporarily affect native control detection.

### Lyrics take too long to appear

The extension stops waiting for Spotify's lyric request after a short timeout and uses
the fastest valid response from either source. If no result appears:

- Check that the track title and artist are visible in Spotify.
- Try reopening Immersive mode.
- Try the exact album or single version of the track.
- Check whether the track has lyrics in Spotify or LRCLIB.

### The background or album art does not update

Refresh the Spotify page after changing tracks or reload the extension. The artwork
uses Spotify's current cover image and may briefly fall back to the lower-resolution
thumbnail while the high-resolution image loads.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt + L` | Open or close Immersive mode |
| `Esc` | Close Immersive mode |

## Project files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension metadata, permissions, and content-script registration |
| `icons/icon.png` | Shared toolbar and extension-manager icon |
| `content.js` | Immersive overlay, lyrics loading, playback controls, seeking, and synchronization |
| `styles.css` | Overlay layout, gradients, controls, progress bar, and empty state |
| `inject.js` | Runs in Spotify's page context to access the page's lyrics requests |
| `background.js` | Retrieves LRCLIB lyrics through the extension background context |

## Development

After changing extension files:

1. Open the extension manager.
2. Click **Reload** on the unpacked extension.
3. Refresh the Spotify tab.
4. Reopen Immersive mode.

For lyric timing adjustments, change `LYRIC_OFFSET` near the top of `content.js`.
The value is measured in seconds; positive values move highlighting later.

## Privacy

The extension is designed to run on the Spotify Web Player and request fallback lyrics
from LRCLIB. It does not add a separate account system or store a Spotify password.
Spotify session requests remain in the page context, and lyric fallback requests are
handled by the extension background service worker.

## License

This repository does not currently declare a software license. Add a license file
before distributing or publishing the extension for reuse.
