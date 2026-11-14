# Auralis

Auralis is a local-first music player. It keeps music, playlists, likes, tags,
lyrics and listening history in the browser, and can discover music from
Audius, YouTube and Jamendo. MusicBrainz provides optional metadata lookup.
This is a non-commercial prototype with no ads, subscriptions or payments.
See [Sources & Licenses](sources.html), the [Privacy Policy](privacy.html),
and [Terms of Use](terms.html). The MIT license covers Auralis source code only;
providers keep their own rights and terms for catalog music and player content.

## Run locally

Use a local HTTP server so browser modules, IndexedDB and the service worker
work in a secure context:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`. Node users can also run `npx serve .`.

## Music sources

- **Local files:** Imported audio and embedded artwork stay in this browser.
  Supported formats include MP3, M4A, AAC, WAV, OGG, FLAC and OPUS. Auralis
  reads common embedded tags and asks before applying MusicBrainz suggestions.
- **Audius:** Public catalog search and streams use Audius endpoints. Auralis
  does not download or cache Audius audio.
- **YouTube:** Search uses YouTube Data API v3; playback uses YouTube’s
  official privacy-enhanced embedded player with its standard controls and
  branding. Playback starts only after the player is visible and pauses when
  it is closed, hidden, or scrolled out of view. Search metadata stays in
  memory. Auralis stores only the video ID, canonical link, and user-created
  library organization. It refreshes metadata when available, and a failed
  refresh does not delete the saved reference. It never downloads, extracts,
  caches, or backs up YouTube audio or video.
- **Jamendo:** Search and streaming use Jamendo API v3. The free non-commercial
  plan currently lists up to 35,000 API requests per month; check Jamendo's
  [developer portal](https://developer.jamendo.com/v3.0) for current limits.
  The free API is for non-commercial use. Do not add ads, payments, paid
  features or donations while using it. Each track carries its own Creative
  Commons terms; keep the artist credit, license badge and Jamendo link with
  the track. Auralis does not download or cache Jamendo audio.
- **MusicBrainz:** Optional metadata lookups and artist release lists only;
  MusicBrainz supplies no audio. Results stay in page memory until the user
  chooses a suggestion. MusicBrainz data is available under its published
  data licenses; this prototype remains non-commercial.

Requests and player content go directly from the browser to the providers.
The service worker caches only Auralis's own app files, never provider API
responses or streamed media.

## Optional public API credentials

Without credentials, local files and Audius continue to work. Credentials are
optional and are stored in this browser's IndexedDB preferences; they are not
included in exported backups. Any key used by a static web app is visible to
visitors, so never put a private secret in the app.

### YouTube Data API key

1. In Google Cloud, create or select a project, enable **YouTube Data API v3**,
   and create an API key.
2. Restrict the key to the YouTube Data API v3 and to HTTP referrers. The app
   sends `strict-origin-when-cross-origin`, so Google receives the origin
   without the `/Auralis/` path. Add both `https://ukg-gta.github.io` and
   `https://ukg-gta.github.io/*`. For local development, add both
   `http://localhost:8000` and `http://localhost:8000/*`, plus both
   `http://127.0.0.1:8000` and `http://127.0.0.1:8000/*` if you use that host.
   GitHub Pages' shared hostname means these restrictions cannot isolate the
   `/Auralis/` path; keep the key restricted to YouTube Data API v3 and use a
   dedicated domain if tighter referrer isolation is needed.
3. In Auralis, open **Settings → Music Sources**, paste the key and save.
   Enable YouTube and agree to the Auralis Privacy Policy and Terms of Use in
   that same section before searching or playing videos. Auralis's terms bind
   users to the YouTube Terms of Service when they use YouTube features.

The default Google Cloud allocation is 100 `search.list` calls per day for the
API project, shared by everyone using the same key. Other read methods use a
separate daily quota. Auralis debounces search by 400 ms, requires at least two
characters, and keeps a short-lived in-memory cache. It reports quota errors;
review current usage in the Google Cloud console. Read the [YouTube API developer policies](https://developers.google.com/youtube/terms/developer-policies),
[YouTube Terms of Service](https://www.youtube.com/t/terms), and
[Google Privacy Policy](https://policies.google.com/privacy).

### Jamendo client ID

1. Create a free application in the [Jamendo Developer Portal](https://devportal.jamendo.com/)
   and copy its public `client_id`.
2. In Auralis, open **Settings → Music Sources**, paste the client ID and save.

The read-only API client ID is public by design. Monitor usage and confirm the
current non-commercial quota and terms in Jamendo's [API documentation](https://developer.jamendo.com/v3.0)
and [API Terms of Use](https://devportal.jamendo.com/api_terms_of_use).

## Privacy, storage and backup

Imported audio, artwork, playlists, likes, tags, lyrics, preferences and
listening history are stored in IndexedDB on this device. YouTube and Jamendo
saved entries are source references, not audio. Export a backup before
clearing browser site data. Backups include local audio and artwork, library
organization and source references; they omit API credentials and remote
audio. See the [Privacy Policy](privacy.html) and [Terms of Use](terms.html).

## Implementation notes and limits

- MusicBrainz requires an identifying `User-Agent` and limits applications to
  about one request per second. Browsers control the `User-Agent` request
  header and do not let this static app supply a maintainer contact, so Auralis
  rate-limits its own requests but cannot fully meet that identification rule
  without a backend. Lookups may be rejected or throttled. No proxy or backend
  is configured.
- YouTube or Jamendo playback can fail when a provider blocks embedding,
  removes a track, restricts a territory, or changes its API. Auralis shows the
  provider link and a retry or skip path where possible.
- MusicBrainz and Cover Art Archive terms can change. Auralis currently uses
  MusicBrainz metadata only and does not request Cover Art Archive images.

## Licenses

The source code is licensed under MIT; see [LICENSE](LICENSE). That license
does not grant rights to third-party music, videos, names or cover art. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for provider terms and
attribution notes.
