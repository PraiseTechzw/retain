import {
  assessFlightRisk,
  type FlightRiskEmployee,
  type FlightRiskLeave,
} from "../lib/analytics/flight-risk.ts";

const now = new Date("2026-01-01T00:00:00.000Z");

function employee(
  overrides: Partial<FlightRiskEmployee> = {},
): FlightRiskEmployee {
  return {
    id: "employee-1",
    full_name: "Synthetic Employee",
    employee_number: "TEST-001",
    employment_status: "active",
    ...overrides,
  };
}

function leave(
  overrides: Partial<FlightRiskLeave> = {},
): FlightRiskLeave {
  return {
    employee_id: "employee-1",
    requested_days: 1,
    starts_on: "2025-06-01",
    status: "approved",
    ...overrides,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("no recorded signal remains a zero/Low review score", () => {
  const result = assessFlightRisk(employee(), [], now);
  assert(result.score === 0, `expected score 0, received ${result.score}`);
  assert(result.level === "Low", `expected Low, received ${result.level}`);
});

Deno.test("only this employee's approved leave in the prior 365 days is counted", () => {
  const result = assessFlightRisk(
    employee(),
    [
      leave({ requested_days: 6 }),
      leave({ employee_id: "another-employee", requested_days: 30 }),
      leave({ status: "pending", requested_days: 30 }),
      leave({ starts_on: "2024-12-31", requested_days: 30 }),
      leave({ starts_on: "2026-01-02", requested_days: 30 }),
    ],
    now,
  );
  assert(result.approvedLeaveDays === 6, "ineligible leave must not be counted");
  assert(result.approvedLeaveRequests === 1, "only one request should count");
  assert(result.score === 10, `expected 10, received ${result.score}`);
});

Deno.test("commute thresholds change score at 10, 25, and 50 km", () => {
  const at10 = assessFlightRisk(employee({ commute_distance_km: 10 }), [], now);
  const at25 = assessFlightRisk(employee({ commute_distance_km: 25 }), [], now);
  const at50 = assessFlightRisk(employee({ commute_distance_km: 50 }), [], now);
  assert(at10.score === 10, `expected 10 at 10 km, received ${at10.score}`);
  assert(at25.score === 19, `expected 19 at 25 km, received ${at25.score}`);
  assert(at50.score === 31, `expected 31 at 50 km, received ${at50.score}`);
  assert(at50.level === "Medium", "score 31 must be Medium");
});

Deno.test("tenure milestone is included through 183 days, not after", () => {
  const inWindow = assessFlightRisk(
    employee({ joined_on: "2023-07-03" }),
    [],
    new Date("2026-01-01T00:00:00.000Z"),
  );
  const outOfWindow = assessFlightRisk(
    employee({ joined_on: "2023-07-03" }),
    [],
    new Date("2025-12-31T00:00:00.000Z"),
  );
  assert(inWindow.score === 19, `expected milestone score 19, received ${inWindow.score}`);
  assert(outOfWindow.score === 0, `expected no milestone score, received ${outOfWindow.score}`);
});

Deno.test("maximum documented inputs normalize to 100/High", () => {
  const requests = Array.from({ length: 6 }, (_, index) =>
    leave({
      requested_days: index === 0 ? 16 : 1,
      starts_on: `2025-0${index + 2}-01`,
    }),
  );
  const result = assessFlightRisk(
    employee({ joined_on: "2023-07-03", commute_distance_km: 50 }),
    requests,
    new Date("2026-01-01T00:00:00.000Z"),
  );
  assert(result.score === 100, `expected 100, received ${result.score}`);
  assert(result.level === "High", `expected High, received ${result.level}`);
});
