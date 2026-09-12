// Builds a Cloudflare KV bulk-upload file from map/facilities.json, so the ten
// existing Fresno listings survive the switch to serving /map/ from the API.
//
// It copies only fields that exist in the source. Absent values stay absent:
// no invented bed totals, prices, rooms, or licence numbers.
//
//   node scripts/seed-facilities.mjs
//   npx wrangler kv bulk put scripts/kv-seed.json --binding FACILITIES --remote
//
// Re-running is safe: keys are the facility ids, so a second upload overwrites
// rather than duplicating.

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "map/facilities.json";
const TARGET = "scripts/kv-seed.json";

const rows = JSON.parse(readFileSync(SOURCE, "utf8"));

const entries = rows.map((row) => {
  const key = String(row.id || "").trim();
  if (!key) throw new Error(`Record without an id: ${JSON.stringify(row)}`);

  return {
    key,
    value: JSON.stringify({
      id: key,
      slug: key,
      facilityName: row.name,
      name: row.name,
      address: row.address,
      care_level: row.care_level,
      phone: row.phone,
      availableBeds: row.beds_available,
      beds_available: row.beds_available,
      lat: row.lat,
      lng: row.lng,
      // Not present in the source file, so not asserted here either.
      license_number: null,
      license_checked_at: null,
      rooms: [],
      last_updated: row.last_updated
    })
  };
});

writeFileSync(TARGET, JSON.stringify(entries, null, 2) + "\n");
console.log(`${entries.length} records -> ${TARGET}`);
for (const e of entries) console.log(`  ${e.key}`);
