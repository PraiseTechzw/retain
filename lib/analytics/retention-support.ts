export type RetentionSupportEmployee = {
  joined_on?: string | null;
  commute_distance_km?: number | null;
};

export type ServiceAnniversary = {
  date: string;
  yearsOfService: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SUPPORT_WINDOW_DAYS = 183;

/** Returns the next service anniversary only when it falls in the next six months. */
export function getUpcomingServiceAnniversary(
  joinedOn: string | null | undefined,
  now = new Date(),
): ServiceAnniversary | null {
  if (!joinedOn) return null;
  const joined = new Date(`${joinedOn.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(joined.getTime()) || joined > now) return null;

  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const thisYear = new Date(joined);
  thisYear.setUTCFullYear(today.getUTCFullYear());
  const next = thisYear >= today
    ? thisYear
    : new Date(Date.UTC(today.getUTCFullYear() + 1, joined.getUTCMonth(), joined.getUTCDate()));
  const daysUntil = (next.getTime() - today.getTime()) / DAY_MS;
  if (daysUntil > SUPPORT_WINDOW_DAYS) return null;

  return {
    date: next.toISOString().slice(0, 10),
    yearsOfService: next.getUTCFullYear() - joined.getUTCFullYear(),
  };
}

/** Validates commute data for neutral support planning; it does not classify risk. */
export function getRecordedCommuteDistance(
  employee: RetentionSupportEmployee,
): number | null {
  const distance = employee.commute_distance_km;
  return typeof distance === "number" && Number.isFinite(distance) && distance >= 0
    ? distance
    : null;
}
