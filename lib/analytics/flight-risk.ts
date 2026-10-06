export type FlightRiskEmployee = {
  id: string;
  full_name: string;
  employee_number: string;
  employment_status?: string | null;
  job_title?: string | null;
  joined_on?: string | null;
  department_name?: string | null;
  home_area?: string | null;
  commute_distance_km?: number | null;
};

export type FlightRiskLeave = {
  employee_id: string;
  requested_days: number;
  starts_on: string;
  status: string;
};

export type FlightRiskAssessment = {
  employee: FlightRiskEmployee;
  score: number;
  level: "Low" | "Medium" | "High";
  approvedLeaveDays: number;
  approvedLeaveRequests: number;
  signals: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function approvedLeaveForYear(
  employeeId: string,
  leaveRequests: FlightRiskLeave[],
  now: Date,
) {
  const yearAgo = new Date(now.getTime() - 365 * DAY_MS);
  return leaveRequests.filter((request) => {
    const start = new Date(request.starts_on);
    return (
      request.employee_id === employeeId &&
      request.status === "approved" &&
      start >= yearAgo &&
      start <= now
    );
  });
}

function isNearTenureMilestone(joinedOn: string, now: Date) {
  const joined = new Date(joinedOn);
  if (Number.isNaN(joined.getTime()) || joined > now) return false;
  return [1, 3, 5, 10, 15, 20].some((years) => {
    const milestone = new Date(joined);
    milestone.setFullYear(joined.getFullYear() + years);
    const daysUntil = (milestone.getTime() - now.getTime()) / DAY_MS;
    return daysUntil >= 0 && daysUntil <= 183;
  });
}

export function assessFlightRisk(
  employee: FlightRiskEmployee,
  leaveRequests: FlightRiskLeave[],
  now = new Date(),
): FlightRiskAssessment {
  const approvedLeave = approvedLeaveForYear(employee.id, leaveRequests, now);
  const approvedLeaveDays = approvedLeave.reduce(
    (total, request) => total + Number(request.requested_days || 0),
    0,
  );
  const signals: string[] = [];
  let rawScore = 0;

  if (approvedLeaveDays > 15) {
    rawScore += 25;
    signals.push(`${approvedLeaveDays.toFixed(1)} approved leave days in 12 months`);
  } else if (approvedLeaveDays > 10) {
    rawScore += 16;
    signals.push(`${approvedLeaveDays.toFixed(1)} approved leave days in 12 months`);
  } else if (approvedLeaveDays > 5) {
    rawScore += 8;
    signals.push(`${approvedLeaveDays.toFixed(1)} approved leave days in 12 months`);
  }
  if (approvedLeave.length >= 6) {
    rawScore += 15;
    signals.push(`${approvedLeave.length} separate approved leave requests in 12 months`);
  } else if (approvedLeave.length >= 4) {
    rawScore += 8;
    signals.push(`${approvedLeave.length} separate approved leave requests in 12 months`);
  }

  if (employee.joined_on && isNearTenureMilestone(employee.joined_on, now)) {
    rawScore += 15;
    signals.push("Within six months of a tenure milestone");
  }

  const commuteDistance = Number(employee.commute_distance_km);
  if (Number.isFinite(commuteDistance) && commuteDistance >= 50) {
    rawScore += 25;
    signals.push(`Long commute recorded (${commuteDistance} km)`);
  } else if (Number.isFinite(commuteDistance) && commuteDistance >= 25) {
    rawScore += 15;
    signals.push(`Elevated commute recorded (${commuteDistance} km)`);
  } else if (Number.isFinite(commuteDistance) && commuteDistance >= 10) {
    rawScore += 8;
    signals.push(`Commute recorded (${commuteDistance} km)`);
  }

  const score = Math.round((rawScore / 80) * 100);
  return {
    employee,
    score,
    level: score >= 65 ? "High" : score >= 30 ? "Medium" : "Low",
    approvedLeaveDays,
    approvedLeaveRequests: approvedLeave.length,
    signals: signals.length ? signals : ["No configured risk signals recorded"],
  };
}
