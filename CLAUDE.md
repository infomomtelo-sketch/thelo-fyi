# CLAUDE.md — thelo.fyi

Static site (vanilla HTML + Tailwind CDN + Leaflet CDN) served from Cloudflare
Pages, with a Cloudflare Worker API in `worker.js` backed by a KV binding named
`FACILITIES`. No build step.

## Working rules

These are standing rules. They apply to every change, not just the one that
introduced them.

1. **Verify every product claim against actual source before writing it.** If
   the data field does not exist, the claim does not ship. Check
   `facilities.json`, `data/`, the `/create` intake form, and
   `worker.js` (`sanitizeFacility` / `toPublicFacility`) before describing
   what a listing shows.
2. **No outcome guarantees, no "verified", no compliance PASS/FAIL.** The word
   "verified" must not appear in any rendered string. Do not reintroduce a
   PASS/FAIL badge, score, or grade anywhere.
3. **Legal pages name no legal entity.** Self-refer as "thelo.fyi".
4. **Copyright line, everywhere:** `© 2026 thelo.fyi. All rights reserved.`
5. **Contact address, everywhere:** hello@thelo.fyi
6. **Report only what is actually committed.** End work with
   `git diff --stat` and `git log --oneline -5`, read from the pushed branch.

## §87307 correction — do not reintroduce

An earlier version of `/app/` graded rooms against "Title 22 minimums: 80 sq ft
single, 60 sq ft per bed multi" and rendered a `PASS/FAIL §87307` verdict.

**That rule does not exist.** 22 CCR §87307 contains no square-footage minimum.
The 80 / 60 numbers were invented. They must never be reintroduced — not in the
UI, not in `worker.js`, not in a `requiredSqft` field, not in seed data.

`/app/` is the **Room planner**. It records room names, bed counts, and floor
area for the operator's own planning. It carries the line "Planning tool only.
Not a compliance determination." It does not evaluate anything.

Compliance is determined solely by CDSS.

## License status on listings

A listing may render license status **only** when a real `license_checked_at`
timestamp exists on the record, alongside a `license_number`.

- Format: `CDSS #<num> — status checked <date>`
- No timestamp → no line at all. Not "pending", not "unverified", no placeholder.
- `worker.js` passes `license_number` and `license_checked_at` through when
  present and stores `null` otherwise; `r/index.html` `renderLicense()` is the
  single render path and hides the element unless both values are present.

As of this writing **no record carries either field**, so no listing renders a
license line. The homepage block claiming "License number on every listing"
is therefore held out of `index.html` until the fields exist and are populated.

## Settled copy decisions

- **Homepage** (`index.html`): flat-fee listing copy. $99/month per home, flat,
  regardless of occupancy. Never paid per resident, no commission, no
  per-admission fee. Free for families and placement agents.
- **Meta tags, every page:**
  - title: `thelo.fyi — Fresno care home listings`
  - description: `Flat-fee listings for licensed Fresno care homes. Operators pay a flat monthly fee, never per resident.`
- **No "Title 22 Score"** anywhere, and no reference to title-22.com.
- **No "Thelo AI" persona language.** The product is a listing map, not an
  assistant. Self-refer as "thelo.fyi", not "Thelo".
- **`/agent/`**: agent access is free. No paywall, no price. The email capture
  is optional and clearly marked as such — the map is browsable without it.
- **`/terms/`**: platform scope, flat-fee payment model, operator
  responsibilities, accuracy, no compliance determination, as-is, removal via
  hello@thelo.fyi.
- **`/disclaimer/`**: body kept as written by the owner. Note that it still
  refers to a "Title 22 checker" and a "floor plan compliance checker" that no
  longer exist; changing it requires the owner's say-so.
- **Nav labels**: List your home · Map · Room planner · Agent access.

## Plain language in operator-facing forms

The people filling in `/create` and `/app/` run care homes; they are not
web developers. Technical field names made them stall and leave. Keep every
visible label in their words, not ours:

- **slug** → "Web address for your listing", with a live `thelo.fyi/r/...`
  preview doing the explaining. Never show the word "slug" on screen, in a
  helper line, or in an error message. The `slug` id/param names stay as-is
  in code.
- **latitude / longitude** → never shown. The operator gives a street address,
  city, state and ZIP; the server places the pin. See "Map pins" below.
- **sq ft** → "Room size in square feet" + "Length times width, in feet. A
  rough number is fine."
- **floor plan upload** → labelled optional, with "Don't have one? Skip this
  — you can add it later." This is only true while nothing validates the
  file: `uploadedFile` defaults to null and no submit guard tests it. If that
  ever changes, change the copy.
- Worker validation errors surface verbatim in the operator's status line, so
  they are written in the same plain language.

## Deployment — the API is not routed (open issue)

Saving from `/app/` fails on the live site with Safari's "Load failed". The
repo has **no `wrangler.toml`, no `functions/` directory, no `_worker.js`, and
no `_routes.json`**, and `CNAME` points at a Cloudflare Pages deploy. A
`worker.js` at the repo root is not executed by Pages — it is served as a
static file. So `/api/*` on thelo.fyi hits the static 404, and
`https://api.thelo.fyi` (the second fallback in `API_BASES`) appears to have no
host behind it.

To make saving work, one of:

- move `worker.js` to `functions/api/[[path]].js` as a Pages Function, or
- deploy it as a standalone Worker with a route on `thelo.fyi/api/*`, or
- point `api.thelo.fyi` at that Worker and keep the existing fallback.

Whichever is chosen, the KV binding must be named `FACILITIES`, and
`ALLOWED_ORIGINS` in `worker.js` must include the origin the browser sends.

Until then `/app/` degrades honestly: the draft is kept in `localStorage`
before the network call, and the operator is told their details are safe rather
than shown a browser error string. Do not replace that message with a raw
`error.message` — "Load failed" and "Failed to fetch" mean nothing to an
operator.

## Map pins are derived, never typed

Operators are asked for an address, never for coordinates. `placePin()` in
`worker.js` resolves them:

1. `ZIP_COORDINATES` — seven Fresno ZIPs, each averaged from the real
   facilities in `facilities.json`. **Every figure is traceable to a committed
   address; none are invented.** They are neighbourhood-level, not
   building-accurate, and `/app/` tells the operator exactly that.
2. `CITY_COORDINATES` — Fresno only, using the centre point this codebase has
   always used for the map's default view.
3. Otherwise **null**. The listing publishes with no pin; `/map/` already
   renders such a listing in the list with "Map pin unavailable for this
   listing." Never substitute a guessed coordinate.

`Number(null)` is `0` and `0` passes a naive finite/range check, which would
drop a pin at 0°,0° in the Atlantic. Both `worker.js` (`coordinate()`) and
`map/index.html` (`toCoord()`) guard against this. Do not simplify either back
to a bare `Number()`.

Coverage is thin — seven ZIPs. A home in Clovis or Sanger currently gets no
pin. Real geocoding at save time is the fix; until then the gap is honest
rather than papered over.

## Known gaps

- `privacy/index.html` says collected data includes "license number". Nothing in
  the intake form collects one. Either add the field or amend the sentence.
- `/create` collects only name, slug, beds, and price; it hands off to `/app/`
  for the rest.
- Map pin coverage is seven Fresno ZIPs plus the city of Fresno. Everything
  else lists without a pin.
- The `/agent/` email capture writes to `localStorage` only. It does not reach
  any server, so no one is actually contacted.
