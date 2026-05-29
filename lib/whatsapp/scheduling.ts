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

export function bogotaParts(date: Date) {
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

function bogotaDateKey(parts: ReturnType<typeof bogotaParts>) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function minutesOfDay(parts: ReturnType<typeof bogotaParts>) {
  return parts.hour * 60 + parts.minute;
}

export function isValidFelicitationSendTime(nowInput: Date, scheduledForInput: Date) {
  const now = new Date(nowInput);
  const scheduledFor = new Date(scheduledForInput);
  const nowParts = bogotaParts(now);
  const scheduledParts = bogotaParts(scheduledFor);

  if (bogotaDateKey(nowParts) !== bogotaDateKey(scheduledParts)) {
    return false;
  }

  const scheduledMinutes = minutesOfDay(scheduledParts);
  const nowMinutes = minutesOfDay(nowParts);
  const morningTarget = 8 * 60 + 26;
  const middayTarget = 12 * 60 + 43;

  if (scheduledMinutes === morningTarget) {
    return nowMinutes >= morningTarget && nowMinutes < 16 * 60;
  }

  if (scheduledMinutes === middayTarget) {
    return nowMinutes >= middayTarget && nowMinutes < 16 * 60;
  }

  return false;
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

  const sameDayMidday = dateAtBogotaWallTime(parts.year, parts.month, parts.day, 12, 43);
  const nextDayMidday = dateAtBogotaWallTime(nextDay.year, nextDay.month, nextDay.day, 12, 43);
  const scheduledAt = isBusinessBlock
    ? dateAtBogotaWallTime(nextDay.year, nextDay.month, nextDay.day, 8, 26)
    : now < sameDayMidday
      ? sameDayMidday
      : nextDayMidday;

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
