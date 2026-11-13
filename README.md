# Auralis

Auralis is a local-first music player for files on this device, with an Audius catalog for discovering and streaming independent music.

## Run locally

Use a local HTTP server so browser modules, IndexedDB, and the service worker work in a secure context:

- Python: `python -m http.server 8000`
- Node: `npx serve .`

Then open `http://localhost:8000`.

## Data and backups

Imported audio, artwork, saved Audius track details, playlists, tags, lyrics, preferences, and listening history are stored in this browser's IndexedDB. Export a backup before clearing site data. Auralis can restore backups created by its own Export backup command.

The service worker caches the application shell for offline launch. Imported audio stays in IndexedDB. Audius tracks stream from Audius and require an internet connection; Auralis does not download or cache their audio.

## Streaming catalog

Browse uses Audius read-only endpoints for trending, underground, new-release, and track-search results. Streamed tracks keep their artist attribution and link back to Audius. Track availability and rights settings are controlled by each artist.

## Licenses

The Auralis source code in this repository is licensed under the MIT License; see [LICENSE](LICENSE). The MIT License does not cover third-party music or artwork. Audius content remains subject to its creator's rights, Audius API terms, and each track's availability settings; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Metadata

Auralis reads common ID3 fields and cover art, Vorbis comments, FLAC comments and pictures, WAV INFO tags, and common MP4/M4A item metadata. When tags are absent, it uses the file name.


