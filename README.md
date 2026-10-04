# Spotify Immersive Lyrics

A Chrome, Edge, or Brave extension that shows Spotify lyrics in a full-screen view with album art and synced scrolling.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open https://open.spotify.com and start playing a song.

## Use

- Press **Alt + L** to open or close full-screen lyrics mode.
- You can also click the **Immersive** button at the bottom right of Spotify.
- Use the previous, play/pause, and next buttons below the album art to control playback.
- Press **Esc** to exit full-screen mode.
- Click a lyric line to seek to that point in the song.

The full-screen background uses the current album cover with a soft, color-matched gradient
that updates when the song changes.

## Hindi songs and missing lyrics

Lyrics come from Spotify first and LRCLIB as a backup. Hindi songs can be missing when Spotify or LRCLIB does not have a lyric match for that particular title, transliteration, remix, or movie version. The extension now tries common title and artist variations, but it cannot display lyrics that neither service provides.

If a song is not found, try playing the exact album or single version and reopen the view with **Alt + L**. Lyrics may also be plain, unsynced text when timestamps are unavailable.

If lyrics feel early or late, adjust `LYRIC_OFFSET` near the top of `content.js`.
