# thelo.fyi

Static marketing and facility-listing site for thelo.fyi, built with vanilla HTML, Tailwind CDN, Leaflet CDN, and a Cloudflare Worker API.

## Pages

- `/` homepage with pricing and calls to action
- `/create` intake form that forwards to the room planner
- `/app/` room planner for recording room names, beds, and floor area (planning only, not a compliance determination)
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
- See `CLAUDE.md` for the standing copy and data-claim rules.
