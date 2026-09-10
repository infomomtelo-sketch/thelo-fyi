# thelo.fyi

Static marketing and facility-listing site for Thelo, built with vanilla HTML, Tailwind CDN, Leaflet CDN, and a Cloudflare Worker API.

## Pages

- `/` homepage with pricing and calls to action
- `/create` intake form that forwards to the floor-plan app
- `/app/` facility engine with Title 22 room compliance checks
- `/r/` referral template that renders by slug
- `/map/` Fresno facility map with availability markers
- `/agent/` agent access landing page

## API

`worker.js` exposes:

- `POST /api/facility`
- `GET /api/facility?id=...` (also accepts `slug=...`)
- `GET /api/facilities`

The worker expects a Cloudflare KV binding named `FACILITIES`.

## Notes

- No build step is required.
- The client stores drafts in `localStorage`.
- The worker rejects likely PHI fields and provides demo Fresno fallback facilities.
