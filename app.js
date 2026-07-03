const config = window.SPOTIFY_CONFIG || {};
const REQUIRED_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state"
].join(" ");

const state = {
  accessToken: null,
  albums: [],
  albumOffset: 0,
  albumsPerPage: 3,
  currentArtist: "",
  selectedAlbum: null,
  tracks: [],
  trackIndex: 0,
  isPlaying: false,
  spotifyPlayer: null,
  spotifyDeviceId: null,
  spotifyPlayerReady: null,
  spotifySdkReady: null
};

const els = {
  pages: {
    search: document.getElementById("searchPage"),
    results: document.getElementById("resultsPage"),
    player: document.getElementById("playerPage")
  },
  searchForm: document.getElementById("searchForm"),
  artistSearch: document.getElementById("artistSearch"),
  searchStatus: document.getElementById("searchStatus"),
  resultsStatus: document.getElementById("resultsStatus"),
  playerStatus: document.getElementById("playerStatus"),
  artistName: document.getElementById("artistName"),
  albumWindow: document.getElementById("albumWindow"),
  albumPrev: document.getElementById("albumPrev"),
  albumNext: document.getElementById("albumNext"),
  resultsBack: document.getElementById("resultsBack"),
  playerBack: document.getElementById("playerBack"),
  coverArt: document.getElementById("coverArt"),
  songName: document.getElementById("songName"),
  prevTrack: document.getElementById("prevTrack"),
  nextTrack: document.getElementById("nextTrack"),
  playPause: document.getElementById("playPause"),
  audio: document.getElementById("audioPlayer"),
  playerVinyl: document.getElementById("playerVinyl"),
  resetAuth: document.getElementById("resetAuth")
};

init();

async function init() {
  state.albumsPerPage = window.matchMedia("(max-width: 680px)").matches ? 2 : 3;
  window.addEventListener("resize", handleResize);
  els.searchForm.addEventListener("submit", handleSearch);
  els.albumPrev.addEventListener("click", () => shiftAlbums(-state.albumsPerPage));
  els.albumNext.addEventListener("click", () => shiftAlbums(state.albumsPerPage));
  els.resultsBack.addEventListener("click", () => showPage("search"));
  els.playerBack.addEventListener("click", () => {
    pausePlayback();
    showPage("results");
  });
  els.prevTrack.addEventListener("click", () => playTrack(state.trackIndex - 1));
  els.nextTrack.addEventListener("click", () => playTrack(state.trackIndex + 1));
  els.playPause.addEventListener("click", togglePlayback);
  els.resetAuth.addEventListener("click", resetSpotifyLogin);

  await finishSpotifyLogin();
  if (!state.accessToken && config.clientId) {
    setStatus(els.searchStatus, `Search will ask you to connect Spotify first. Redirect: ${getRedirectUri()}`);
  }
  if (!config.clientId || config.clientId.includes("paste-your")) {
    setStatus(els.searchStatus, "Add your Spotify client ID to spotify-config.js to start.");
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const query = els.artistSearch.value.trim();
  if (!query) {
    setStatus(els.searchStatus, "Type an artist name first.");
    return;
  }

  try {
    setStatus(els.searchStatus, "Looking through the crates...");
    const token = await getAccessToken();
    const artist = await findArtist(token, query);
    if (!artist) {
      setStatus(els.searchStatus, `No artist found for "${query}".`);
      return;
    }

    const albums = await findAlbums(token, artist.id);
    state.currentArtist = artist.name;
    state.albums = albums;
    state.albumOffset = 0;
    els.artistName.textContent = artist.name;
    renderAlbums();
    showPage("results");
    setStatus(els.searchStatus, "");
    setStatus(els.resultsStatus, albums.length ? "" : "No albums found for this artist.");
  } catch (error) {
    setStatus(els.searchStatus, error.message || "Something went sideways while searching.");
  }
}

async function selectAlbum(album) {
  try {
    setStatus(els.resultsStatus, "Warming up Spotify...");
    const token = await getAccessToken();
    const tracks = await findTracks(token, album.id);
    state.selectedAlbum = album;
    state.tracks = tracks;
    state.trackIndex = 0;
    els.coverArt.style.backgroundImage = album.images?.[0]?.url ? `url("${album.images[0].url}")` : "";
    els.coverArt.classList.toggle("placeholder-cover", !album.images?.[0]?.url);
    els.coverArt.setAttribute("aria-label", `${album.name} album cover`);
    showPage("player");
    setStatus(els.resultsStatus, "");
    setStatus(els.playerStatus, "Connecting Spotify player...");
    await initializeSpotifyPlayer(token);
    await playTrack(0);
  } catch (error) {
    setStatus(els.resultsStatus, error.message || "Could not load that album.");
    setStatus(els.playerStatus, error.message || "Could not load that album.");
  }
}

async function playTrack(index) {
  if (!state.tracks.length || !state.selectedAlbum) return;
  const nextIndex = (index + state.tracks.length) % state.tracks.length;
  const track = state.tracks[nextIndex];
  state.trackIndex = nextIndex;
  els.songName.textContent = track.name;

  try {
    const token = await getAccessToken();
    await initializeSpotifyPlayer(token);
    await startSpotifyPlayback(token, nextIndex);
    setPlaying(true);
    setStatus(els.playerStatus, "");
  } catch (error) {
    setPlaying(false);
    setStatus(els.playerStatus, error.message || "Could not start Spotify playback.");
  }
}

async function togglePlayback() {
  if (!state.spotifyPlayer) {
    await playTrack(state.trackIndex);
    return;
  }

  try {
    await state.spotifyPlayer.togglePlay();
  } catch (error) {
    setStatus(els.playerStatus, error.message || "Could not toggle Spotify playback.");
  }
}

async function pausePlayback() {
  if (state.spotifyPlayer) {
    await state.spotifyPlayer.pause().catch(() => {});
  }
  setPlaying(false);
}

function setPlaying(isPlaying) {
  state.isPlaying = isPlaying;
  els.playPause.textContent = isPlaying ? "Ⅱ" : "▶";
  els.playPause.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  els.playerVinyl.classList.toggle("is-spinning", isPlaying);
}

function renderAlbums() {
  els.albumWindow.innerHTML = "";
  const visible = state.albums.slice(state.albumOffset, state.albumOffset + state.albumsPerPage);
  visible.forEach((album) => {
    const button = document.createElement("button");
    button.className = "album-card";
    button.type = "button";
    button.addEventListener("click", () => selectAlbum(album));

    const img = document.createElement("img");
    img.src = album.images?.[0]?.url || "vinyl-cutout.png";
    img.alt = `${album.name} album cover`;

    const label = document.createElement("span");
    label.textContent = album.name;

    button.append(img, label);
    els.albumWindow.append(button);
  });

  els.albumPrev.disabled = state.albumOffset === 0;
  els.albumNext.disabled = state.albumOffset + state.albumsPerPage >= state.albums.length;
  els.albumPrev.style.opacity = els.albumPrev.disabled ? "0.3" : "1";
  els.albumNext.style.opacity = els.albumNext.disabled ? "0.3" : "1";
}

function shiftAlbums(amount) {
  const maxOffset = Math.max(0, state.albums.length - state.albumsPerPage);
  state.albumOffset = Math.min(maxOffset, Math.max(0, state.albumOffset + amount));
  renderAlbums();
}

function showPage(name) {
  Object.values(els.pages).forEach((page) => page.classList.remove("is-active"));
  els.pages[name].classList.add("is-active");
}

function handleResize() {
  const nextCount = window.matchMedia("(max-width: 680px)").matches ? 2 : 3;
  if (nextCount !== state.albumsPerPage) {
    state.albumsPerPage = nextCount;
    state.albumOffset = Math.floor(state.albumOffset / nextCount) * nextCount;
    renderAlbums();
  }
}

async function findArtist(token, query) {
  const params = new URLSearchParams({
    q: query,
    type: "artist",
    market: "US"
  });
  const data = await spotifyFetch(`/search?${params.toString()}`, token);
  return data.artists.items[0] || null;
}

async function findAlbums(token, artistId) {
  const params = new URLSearchParams({
    include_groups: "album,single",
    market: "US"
  });
  const data = await spotifyFetch(`/artists/${artistId}/albums?${params.toString()}`, token);
  const seen = new Set();
  return data.items.filter((album) => {
    const key = album.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function findTracks(token, albumId) {
  const params = new URLSearchParams({
    market: "US"
  });
  const data = await spotifyFetch(`/albums/${albumId}/tracks?${params.toString()}`, token);
  return data.items;
}

async function spotifyFetch(path, token) {
  return spotifyRequest(path, token);
}

async function spotifyRequest(path, token, options = {}) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = await readSpotifyResponse(response);

  if (response.status === 401) {
    resetSpotifySession();
    throw new Error("Spotify session expired. Search again to reconnect.");
  }
  if (!response.ok) {
    throw new Error(getSpotifyErrorMessage(response, data));
  }
  return data;
}

async function getAccessToken() {
  const cached = sessionStorage.getItem("spotify_access_token");
  const expiresAt = Number(sessionStorage.getItem("spotify_token_expires_at") || 0);
  const cachedScopes = sessionStorage.getItem("spotify_token_scopes");
  if (cached && cachedScopes === REQUIRED_SCOPES && Date.now() < expiresAt) {
    state.accessToken = cached;
    return cached;
  }
  if (cached && cachedScopes !== REQUIRED_SCOPES) {
    resetSpotifySession();
  }
  await startSpotifyLogin();
  throw new Error("Connecting to Spotify...");
}

async function startSpotifyLogin() {
  if (!config.clientId || config.clientId.includes("paste-your")) {
    throw new Error("Missing Spotify client ID in spotify-config.js.");
  }

  const verifier = randomString(64);
  const challenge = await pkceChallenge(verifier);
  sessionStorage.setItem("spotify_code_verifier", verifier);
  sessionStorage.setItem("pending_artist_search", els.artistSearch.value.trim());

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: REQUIRED_SCOPES,
    redirect_uri: getRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

async function finishSpotifyLogin() {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("error");
  if (authError) {
    resetSpotifySession();
    history.replaceState({}, document.title, window.location.pathname);
    setStatus(els.searchStatus, `Spotify login stopped: ${authError}. Try searching again.`);
    return;
  }

  const code = params.get("code");
  if (!code) return;

  const verifier = sessionStorage.getItem("spotify_code_verifier");
  if (!verifier) {
    history.replaceState({}, document.title, window.location.pathname);
    setStatus(els.searchStatus, "Spotify login was reset. Try searching again.");
    return;
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await readSpotifyResponse(response);

  history.replaceState({}, document.title, window.location.pathname);
  if (!response.ok) {
    resetSpotifySession();
    setStatus(els.searchStatus, getSpotifyErrorMessage(response, data));
    return;
  }

  state.accessToken = data.access_token;
  sessionStorage.setItem("spotify_access_token", data.access_token);
  sessionStorage.setItem("spotify_token_scopes", REQUIRED_SCOPES);
  sessionStorage.setItem("spotify_token_expires_at", String(Date.now() + data.expires_in * 1000 - 30000));

  const pendingSearch = sessionStorage.getItem("pending_artist_search");
  sessionStorage.removeItem("pending_artist_search");
  if (pendingSearch) {
    els.artistSearch.value = pendingSearch;
    els.searchForm.requestSubmit();
  }
}

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

function resetSpotifyLogin() {
  resetSpotifySession();
  setStatus(els.searchStatus, `Spotify login reset. Add this exact redirect URI in Spotify: ${getRedirectUri()}`);
}

function resetSpotifySession() {
  state.accessToken = null;
  if (state.spotifyPlayer) {
    state.spotifyPlayer.disconnect();
  }
  state.spotifyPlayer = null;
  state.spotifyDeviceId = null;
  state.spotifyPlayerReady = null;
  sessionStorage.removeItem("spotify_access_token");
  sessionStorage.removeItem("spotify_token_scopes");
  sessionStorage.removeItem("spotify_token_expires_at");
  sessionStorage.removeItem("spotify_code_verifier");
  sessionStorage.removeItem("pending_artist_search");
}

async function initializeSpotifyPlayer(token) {
  if (state.spotifyPlayer && state.spotifyDeviceId) return state.spotifyDeviceId;

  await loadSpotifySdk();
  state.accessToken = token;

  state.spotifyPlayerReady = new Promise((resolve, reject) => {
    const player = new Spotify.Player({
      name: "Find My Albums Record Player",
      getOAuthToken: (callback) => callback(state.accessToken),
      volume: 0.75
    });

    player.addListener("ready", ({ device_id }) => {
      state.spotifyDeviceId = device_id;
      resolve(device_id);
    });

    player.addListener("not_ready", () => {
      setStatus(els.playerStatus, "Spotify player went offline. Press play to reconnect.");
      state.spotifyDeviceId = null;
    });

    player.addListener("player_state_changed", (playbackState) => {
      if (!playbackState) return;
      const currentTrack = playbackState.track_window.current_track;
      const matchingIndex = state.tracks.findIndex((track) => track.uri === currentTrack.uri);
      if (matchingIndex >= 0) state.trackIndex = matchingIndex;
      els.songName.textContent = currentTrack.name;
      if (currentTrack.album?.images?.[0]?.url) {
        els.coverArt.style.backgroundImage = `url("${currentTrack.album.images[0].url}")`;
        els.coverArt.classList.remove("placeholder-cover");
      }
      setPlaying(!playbackState.paused);
    });

    player.addListener("initialization_error", ({ message }) => reject(new Error(message)));
    player.addListener("authentication_error", ({ message }) => {
      resetSpotifySession();
      reject(new Error(`Spotify authentication error. ${message}`));
    });
    player.addListener("account_error", ({ message }) => {
      reject(new Error(`Spotify Premium playback is required. ${message}`));
    });
    player.addListener("playback_error", ({ message }) => {
      setStatus(els.playerStatus, `Spotify playback error. ${message}`);
    });

    state.spotifyPlayer = player;
    player.connect().then((connected) => {
      if (!connected) reject(new Error("Spotify player could not connect in this browser."));
    });
  });

  return state.spotifyPlayerReady;
}

async function startSpotifyPlayback(token, trackIndex) {
  const deviceId = await initializeSpotifyPlayer(token);
  await spotifyRequest("/me/player", token, {
    method: "PUT",
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false
    })
  });
  await spotifyRequest(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, token, {
    method: "PUT",
    body: JSON.stringify({
      context_uri: state.selectedAlbum.uri,
      offset: { position: trackIndex },
      position_ms: 0
    })
  });
}

function loadSpotifySdk() {
  if (window.Spotify) return Promise.resolve();
  if (state.spotifySdkReady) return state.spotifySdkReady;

  state.spotifySdkReady = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Could not load Spotify Web Playback SDK."));
    document.body.appendChild(script);
  });

  return state.spotifySdkReady;
}

async function readSpotifyResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getSpotifyErrorMessage(response, data) {
  const apiMessage = data?.error?.message || data?.error_description || data?.error || data?.raw;
  const detail = apiMessage ? ` ${apiMessage}` : "";
  return `Spotify API error ${response.status}.${detail}`;
}

async function pkceChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (value) => chars[value % chars.length]).join("");
}

function setStatus(element, message) {
  element.textContent = message;
}
