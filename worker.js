const DEMO_FACILITIES = [
  {
    facilityName: "Fresno Garden House",
    slug: "fresno-garden-house",
    totalBeds: 6,
    availableBeds: 2,
    price: 3500,
    lat: 36.7378,
    lng: -119.7871,
    complianceStatus: "PASS",
    rooms: [
      { name: "Room A", beds: 1, sqft: 110, requiredSqft: 80, status: "PASS" },
      { name: "Room B", beds: 2, sqft: 140, requiredSqft: 120, status: "PASS" }
    ]
  },
  {
    facilityName: "Fig Garden Care",
    slug: "fig-garden-care",
    totalBeds: 4,
    availableBeds: 0,
    price: 4200,
    lat: 36.8082,
    lng: -119.8318,
    complianceStatus: "PASS",
    rooms: [
      { name: "Front Suite", beds: 1, sqft: 104, requiredSqft: 80, status: "PASS" },
      { name: "Shared Wing", beds: 2, sqft: 150, requiredSqft: 120, status: "PASS" }
    ]
  },
  {
    facilityName: "Central Valley Retreat",
    slug: "central-valley-retreat",
    totalBeds: 5,
    availableBeds: 1,
    price: 3900,
    lat: 36.7712,
    lng: -119.7451,
    complianceStatus: "PASS",
    rooms: [
      { name: "Sunrise", beds: 1, sqft: 90, requiredSqft: 80, status: "PASS" },
      { name: "Orchard", beds: 2, sqft: 132, requiredSqft: 120, status: "PASS" }
    ]
  }
];

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

function hasPhi(payload) {
  const raw = JSON.stringify(payload || {});
  return PHI_PATTERNS.some((pattern) => pattern.test(raw));
}

function sanitizeFacility(payload) {
  const facilityName = String(payload.facilityName || "").trim();
  const slug = normalizeSlug(payload.slug || facilityName);
  const totalBeds = Number(payload.totalBeds || 0);
  const availableBeds = Number(payload.availableBeds || 0);
  const price = Number(payload.price || 0);
  const lat = Number(payload.lat || 36.7378);
  const lng = Number(payload.lng || -119.7871);
  const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];

  const normalizedRooms = rooms.map((room, index) => {
    const beds = Math.max(1, Number(room.beds || 1));
    const sqft = Math.max(0, Number(room.sqft || 0));
    const requiredSqft = beds <= 1 ? 80 : beds * 60;
    return {
      name: String(room.name || `Room ${index + 1}`).trim(),
      beds,
      sqft,
      requiredSqft,
      status: sqft >= requiredSqft ? "PASS" : "FAIL"
    };
  });

  if (!facilityName || !slug) {
    throw new Error("Facility name and slug are required.");
  }
  if (!Number.isFinite(totalBeds) || totalBeds < 1) {
    throw new Error("Total beds must be at least 1.");
  }
  if (!Number.isFinite(availableBeds) || availableBeds < 0 || availableBeds > totalBeds) {
    throw new Error("Available beds must be between 0 and total beds.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be 0 or greater.");
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Latitude and longitude are required.");
  }
  if (!normalizedRooms.length) {
    throw new Error("At least one room is required.");
  }

  return {
    facilityName,
    slug,
    totalBeds,
    availableBeds,
    price,
    lat,
    lng,
    complianceStatus: normalizedRooms.every((room) => room.status === "PASS") ? "PASS" : "FAIL",
    floorPlan: payload.floorPlan && payload.floorPlan.name ? {
      name: String(payload.floorPlan.name),
      size: Number(payload.floorPlan.size || 0),
      type: String(payload.floorPlan.type || "")
    } : null,
    rooms: normalizedRooms,
    updatedAt: new Date().toISOString()
  };
}

async function listStoredFacilities(env) {
  const keys = await env.FACILITIES.list();
  if (!keys.keys.length) {
    return DEMO_FACILITIES;
  }

  const facilities = await Promise.all(
    keys.keys.map(async ({ name }) => {
      const value = await env.FACILITIES.get(name, "json");
      return value;
    })
  );
  return facilities.filter(Boolean);
}

export default {
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
      const slug = normalizeSlug(url.searchParams.get("slug"));
      if (!slug) {
        return json({ error: "Slug is required." }, 400, origin);
      }
      const stored = await env.FACILITIES.get(slug, "json");
      const fallback = DEMO_FACILITIES.find((facility) => facility.slug === slug) || DEMO_FACILITIES[0];
      return json({ facility: stored || fallback }, 200, origin);
    }

    if (url.pathname === "/api/facilities" && request.method === "GET") {
      const facilities = await listStoredFacilities(env);
      return json({ facilities }, 200, origin);
    }

    return json({ error: "Not found." }, 404, origin);
  }
};
