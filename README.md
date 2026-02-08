# Video Stream Backend

A simple Express backend that streams remote video files with full HTTP Range support.

## Requirements
- Node.js 18+

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The server runs at `http://localhost:4000` by default.

## Endpoints

- `GET /health` → `{ ok: true }`
- `GET /api/movies` → list of movies with stream endpoints
- `GET /api/movies/:id` → movie details
- `GET /api/stream/:id` → streams video with Range support

## Movies

Edit `movies.js` and set `remoteUrl` for each movie. It must be a **direct** video file URL (MP4 or HLS `.m3u8`). Share pages that require cookies or redirects to HTML will be rejected with:

```
Provided link is not a direct video file URL. Use a direct MP4/HLS URL.
```

## Test in Browser

```html
<video controls src="http://localhost:4000/api/stream/1"></video>
```

## Notes

- Range requests are forwarded upstream to support seeking.
- Only URLs in `movies.js` are allowed (no arbitrary URL input).
- Basic rate limiting protects the streaming endpoint.
