# Find My Albums

A cute pixel-art album finder built with JavaScript and the Spotify API. Search for an artist, browse their albums, pick one, and play it through a tiny animated record-player interface.

## Demo

Watch the demo: [https://youtu.be/NAR7Iwtoi_U](https://youtu.be/NAR7Iwtoi_U)

## What It Does

- Searches Spotify for an artist by name
- Displays album results in a carousel-style results view
- Lets users select an album and open a dedicated music player page
- Plays full Spotify tracks in the browser using the Spotify Web Playback SDK
- Includes play/pause, previous track, and next track controls
- Animates the vinyl while music is playing
- Uses custom pixel-style record player and vinyl assets
- Keeps Spotify app configuration out of committed source files

## How It Works

The app is a static HTML, CSS, and JavaScript project. It uses Spotify's Authorization Code with PKCE flow so the browser can authenticate safely without storing a client secret.

After the user logs in with Spotify, the app:

1. Uses the Spotify Web API to search for artists.
2. Fetches albums for the selected artist.
3. Fetches tracks for the selected album.
4. Loads the Spotify Web Playback SDK.
5. Creates a browser-based Spotify Connect device.
6. Sends playback commands to Spotify so the selected album plays through the app's custom UI.

Because full Spotify playback uses the Web Playback SDK, playback requires a Spotify Premium account.

## Tech Stack

- JavaScript
- HTML
- CSS
- Spotify Web API
- Spotify Web Playback SDK
- Spotify OAuth with PKCE

## Project Structure

```txt
.
├── index.html
├── styles.css
├── app.js
├── spotify-config.example.js
├── record-player-cutout.png
├── vinyl-cutout.png
├── tonearm-overlay.png
└── README.md
```

## Notes

- Spotify Premium is required for full in-browser playback.
- The app uses PKCE authentication, so no client secret is needed in the frontend.
- If Spotify login or playback gets stuck, there's an in-app "Reset Spotify Login" button to log in again.
