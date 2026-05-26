import "server-only";

const BOGOTA_TIME_ZONE = "America/Bogota";
const HOUR_MS = 60 * 60 * 1000;

export type FelicitationScheduleResult =
  | {
      canSchedule: true;
      replyWindowExpiresAt: Date;
      safeDeadlineAt: Date;
      felicitationScheduledFor: Date;
    }
  | {
      canSchedule: false;
      replyWindowExpiresAt: Date;
      safeDeadlineAt: Date;
      reason: "window_expired" | "scheduled_outside_reply_window";
    };

function bogotaParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function dateAtBogotaWallTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
) {
  return new Date(Date.UTC(year, month - 1, day, hour + 5, minute, 0, 0));
}

function addBogotaDays(date: Date, days: number) {
  const parts = bogotaParts(date);
  const noonUtc = Date.UTC(parts.year, parts.month - 1, parts.day + days, 17, 0, 0, 0);
  const nextParts = bogotaParts(new Date(noonUtc));

  return {
    year: nextParts.year,
    month: nextParts.month,
    day: nextParts.day,
  };
}

export function isWithinBogotaBusinessHours(date: Date) {
  const parts = bogotaParts(date);
  return parts.hour >= 8 && parts.hour < 16;
}

export function calculateFelicitationSchedule(
  lastInboundAtInput: Date,
  nowInput = new Date()
): FelicitationScheduleResult {
  const lastInboundAt = new Date(lastInboundAtInput);
  const now = new Date(nowInput);
  const replyWindowExpiresAt = new Date(lastInboundAt.getTime() + 24 * HOUR_MS);
  const safeDeadlineAt = new Date(lastInboundAt.getTime() + 23 * HOUR_MS);

  if (now >= replyWindowExpiresAt) {
    return {
      canSchedule: false,
      replyWindowExpiresAt,
      safeDeadlineAt,
      reason: "window_expired",
    };
  }

  const parts = bogotaParts(lastInboundAt);
  const nextDay = addBogotaDays(lastInboundAt, 1);
  const isMorningBeforeBusiness = parts.hour < 8;
  const isBusinessBlock = parts.hour >= 8 && parts.hour < 16;

  const scheduledAt = isBusinessBlock
    ? dateAtBogotaWallTime(nextDay.year, nextDay.month, nextDay.day, 8, 26)
    : dateAtBogotaWallTime(
        isMorningBeforeBusiness ? parts.year : nextDay.year,
        isMorningBeforeBusiness ? parts.month : nextDay.month,
        isMorningBeforeBusiness ? parts.day : nextDay.day,
        12,
        43
      );

  if (scheduledAt >= now && scheduledAt <= replyWindowExpiresAt) {
    return {
      canSchedule: true,
      replyWindowExpiresAt,
      safeDeadlineAt,
      felicitationScheduledFor: scheduledAt,
    };
  }

  return {
    canSchedule: false,
    replyWindowExpiresAt,
    safeDeadlineAt,
    reason: "scheduled_outside_reply_window",
  };
}
