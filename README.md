# Auralis

Auralis is a local-first music player for audio files you add from this device.

## Run locally

Use a local HTTP server so browser modules, IndexedDB, and the service worker work in a secure context:

- Python: \`python -m http.server 8000\`
- Node: \`npx serve .\`

Then open \`http://localhost:8000\`.

## Data and backups

Imported audio, artwork, playlists, tags, lyrics, preferences, and listening history are stored in this browser's IndexedDB. Export a backup before clearing site data. Auralis can restore backups created by its own Export backup command.

The service worker caches the application shell for offline launch. It does not upload or cache imported audio files in the network cache; audio stays in IndexedDB.

## Metadata

Auralis reads common ID3 fields and cover art, Vorbis comments, FLAC comments and pictures, WAV INFO tags, and common MP4/M4A item metadata. When tags are absent, it uses the file name.

