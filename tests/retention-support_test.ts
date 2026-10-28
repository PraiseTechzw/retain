import {
  getRecordedCommuteDistance,
  getUpcomingServiceAnniversary,
} from "../lib/analytics/retention-support.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("upcoming service anniversary is shown within six months", () => {
  const anniversary = getUpcomingServiceAnniversary(
    "2023-07-03",
    new Date("2026-01-01T00:00:00.000Z"),
  );
  assert(anniversary?.date === "2026-07-03", "expected next anniversary date");
  assert(anniversary.yearsOfService === 3, "expected three years of service");
});

Deno.test("service anniversary outside the review window is omitted", () => {
  const anniversary = getUpcomingServiceAnniversary(
    "2023-07-04",
    new Date("2026-01-01T00:00:00.000Z"),
  );
  assert(anniversary === null, "expected no anniversary in the next six months");
});

Deno.test("invalid start dates are omitted", () => {
  assert(
    getUpcomingServiceAnniversary("not-a-date", new Date("2026-01-01T00:00:00Z")) === null,
    "expected invalid dates to be ignored",
  );
});

Deno.test("commute data is returned as context without classification", () => {
  assert(
    getRecordedCommuteDistance({ commute_distance_km: 72 }) === 72,
    "expected recorded commute distance",
  );
  assert(
    getRecordedCommuteDistance({ commute_distance_km: -1 }) === null,
    "negative commute values should be treated as missing",
  );
  assert(
    getRecordedCommuteDistance({ commute_distance_km: null }) === null,
    "missing commute values should remain missing",
  );
});
