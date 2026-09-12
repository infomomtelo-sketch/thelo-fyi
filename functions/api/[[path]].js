// Neighbourhood-level coordinates per ZIP, averaged from the real Fresno
// facilities in facilities.json. These place a pin in the right part of town;
// they are not building-accurate and must not be presented as exact. A ZIP that
// is not listed here yields no pin at all rather than a guessed one - the map
// already renders such a listing without a marker.
const ZIP_COORDINATES = {
  "93705": { lat: 36.7812, lng: -119.8188 },
  "93706": { lat: 36.7082, lng: -119.7284 },
  "93711": { lat: 36.8236, lng: -119.8206 },
  "93720": { lat: 36.8344, lng: -119.7836 },
  "93722": { lat: 36.7947, lng: -119.8705 },
  "93727": { lat: 36.7315, lng: -119.7252 },
  "93730": { lat: 36.8711, lng: -119.7830 }
};

// Falls back to the city only where we have a figure for it. Fresno's is the
// centre point this codebase has always used for the map's default view.
const CITY_COORDINATES = {
  "fresno": { lat: 36.7378, lng: -119.7871 }
};

function coordinate(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function placePin(zip, city) {
  const byZip = ZIP_COORDINATES[String(zip || "").trim()];
  if (byZip) return byZip;
  const byCity = CITY_COORDINATES[String(city || "").trim().toLowerCase()];
  if (byCity) return byCity;
  return null;
}

function composeAddress({ street, city, state, zip }) {
  const line = [street, city].filter(Boolean).join(", ");
  const region = [state, zip].filter(Boolean).join(" ");
  return [line, region].filter(Boolean).join(" ").trim();
}

const ALLOWED_ORIGINS = new Set([
  "https://thelo.fyi",
  "https://www.thelo.fyi"
]);

const PHI_PATTERNS = [
  /\bpatient\b/i,
  /\bresident name\b/i,
  /\bdiagnosis\b/i,
  /\bssn\b/i,
  /\bdob\b/i,
  /\bmedical record\b/i,
  /\bmedicare\b/i,
  /\bmedicaid\b/i,
  /\binsurance\b/i
];

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://thelo.fyi";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(body, status = 200, origin = "https://thelo.fyi") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

function normalizeSlug(slug) {
  return String(slug || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function publicFacilityId(facility) {
  return String(facility?.id || facility?.slug || facility?.facilityName || facility?.name || "").trim();
}

function toPublicFacility(facility) {
  const id = publicFacilityId(facility) || normalizeSlug(facility?.facilityName || facility?.name);
  const slug = normalizeSlug(facility?.slug || id);
  const name = String(facility?.name || facility?.facilityName || "").trim();
  const bedsAvailable = Number(facility?.beds_available ?? facility?.availableBeds ?? 0);
  const lastUpdated = facility?.last_updated || facility?.updatedAt || new Date().toISOString();

  return {
    id,
    slug,
    name,
    address: String(facility?.address || "").trim(),
    beds_available: Number.isFinite(bedsAvailable) ? bedsAvailable : 0,
    care_level: String(facility?.care_level || facility?.careLevel || "RCFE").trim() || "RCFE",
    phone: String(facility?.phone || "").trim(),
    last_updated: lastUpdated,
    lat: coordinate(facility?.lat),
    lng: coordinate(facility?.lng),
    total_beds: Number(facility?.totalBeds ?? 0),
    price: Number(facility?.price ?? 0),
    license_number: facility?.license_number ? String(facility.license_number).trim() : null,
    license_checked_at: facility?.license_checked_at ? String(facility.license_checked_at).trim() : null,
    rooms: Array.isArray(facility?.rooms) ? facility.rooms : []
  };
}

function matchesFacility(facility, value) {
  if (!value) return false;
  const normalized = normalizeSlug(value);
  return [facility.id, facility.slug, facility.name]
    .filter(Boolean)
    .some((candidate) => String(candidate) === String(value) || normalizeSlug(candidate) === normalized);
}

function hasPhi(payload) {
  const raw = JSON.stringify(payload || {});
  return PHI_PATTERNS.some((pattern) => pattern.test(raw));
}

function sanitizeFacility(payload) {
  const facilityName = String(payload.facilityName || "").trim();
  const slug = normalizeSlug(payload.slug || facilityName);
  const id = String(payload.id || slug).trim() || slug;
  const totalBeds = Number(payload.totalBeds || 0);
  const availableBeds = Number(payload.availableBeds || 0);
  const price = Number(payload.price || 0);
  const street = String(payload.street || "").trim();
  const city = String(payload.city || "").trim();
  const state = String(payload.state || "").trim();
  const zip = String(payload.zip || "").trim();
  const address = String(payload.address || "").trim() || composeAddress({ street, city, state, zip });
  const pin = placePin(zip, city);
  const careLevel = String(payload.care_level || payload.careLevel || "RCFE").trim() || "RCFE";
  const phone = String(payload.phone || "").trim();
  const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
  const timestamp = new Date().toISOString();

  const normalizedRooms = rooms.map((room, index) => {
    const beds = Math.max(1, Number(room.beds || 1));
    const sqft = Math.max(0, Number(room.sqft || 0));
    return {
      name: String(room.name || `Room ${index + 1}`).trim(),
      beds,
      sqft
    };
  });

  if (!facilityName || !slug) {
    throw new Error("Please fill in your home's name and its web address.");
  }
  if (!Number.isFinite(totalBeds) || totalBeds < 1) {
    throw new Error("Total beds must be at least 1.");
  }
  if (!Number.isFinite(availableBeds) || availableBeds < 0 || availableBeds > totalBeds) {
    throw new Error("Beds open right now cannot be more than your total beds.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Monthly rate must be 0 or more.");
  }
  if (!address) {
    throw new Error("Please fill in your street address, city and ZIP code.");
  }
  if (!normalizedRooms.length) {
    throw new Error("Add at least one room.");
  }

  return {
    id,
    facilityName,
    slug,
    address,
    totalBeds,
    availableBeds,
    care_level: careLevel,
    phone,
    price,
    street,
    city,
    state,
    zip,
    // Null where the ZIP is outside the table: the listing still publishes, it
    // simply carries no map pin.
    lat: pin ? pin.lat : null,
    lng: pin ? pin.lng : null,
    license_number: payload.license_number ? String(payload.license_number).trim() : null,
    license_checked_at: payload.license_checked_at ? String(payload.license_checked_at).trim() : null,
    floorPlan: payload.floorPlan && payload.floorPlan.name ? {
      name: String(payload.floorPlan.name),
      size: Number(payload.floorPlan.size || 0),
      type: String(payload.floorPlan.type || "")
    } : null,
    rooms: normalizedRooms,
    updatedAt: timestamp,
    last_updated: timestamp
  };
}

async function listStoredFacilities(env) {
  const keys = await env.FACILITIES.list();
  if (!keys.keys.length) {
    // An empty store returns an empty list. It must never fall back to invented
    // records: a fabricated facility served as a real listing is indistinguishable
    // from a real one to a family reading it.
    return [];
  }

  const facilities = await Promise.all(
    keys.keys.map(async ({ name }) => {
      const value = await env.FACILITIES.get(name, "json");
      return value;
    })
  );
  return facilities.filter(Boolean);
}

// Cloudflare Pages Function. Serves every /api/* path; Pages continues to serve
// all other routes as static assets, untouched.
//
// Pages Functions call a named handler with a context object, where a Worker
// module exports { fetch }. onRequest below is that adapter; the request URL is
// the full original path, so the pathname checks are unchanged from when this
// file was worker.js at the repo root.
export async function onRequest(context) {
  return handleRequest(context.request, context.env);
}

const api = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "https://thelo.fyi";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (url.pathname === "/api/facility" && request.method === "POST") {
      try {
        const payload = await request.json();
        if (hasPhi(payload)) {
          return json({ error: "PHI is not allowed." }, 400, origin);
        }
        const facility = sanitizeFacility(payload);
        await env.FACILITIES.put(facility.slug, JSON.stringify(facility));
        return json({ ok: true, facility }, 200, origin);
      } catch (error) {
        return json({ error: error.message || "Invalid request." }, 400, origin);
      }
    }

    if (url.pathname === "/api/facility" && request.method === "GET") {
      const id = String(url.searchParams.get("id") || "").trim();
      const slug = String(url.searchParams.get("slug") || "").trim();
      const lookupValue = id || slug;

      if (!lookupValue) {
        return json({ error: "id is required." }, 400, origin);
      }

      const facilities = await listStoredFacilities(env);
      const found = facilities.find((facility) => matchesFacility(toPublicFacility(facility), lookupValue));

      if (!found) {
        return json({ error: "Facility not found." }, 404, origin);
      }

      return json(toPublicFacility(found), 200, origin);
    }

    if (url.pathname === "/api/facilities" && request.method === "GET") {
      const facilities = await listStoredFacilities(env);
      return json(facilities.map((facility) => toPublicFacility(facility)), 200, origin);
    }

    return json({ error: "Not found." }, 404, origin);
  }
};

function handleRequest(request, env) {
  return api.fetch(request, env);
}
