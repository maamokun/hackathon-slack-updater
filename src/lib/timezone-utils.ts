/**
 * Converts a local date and time to UTC
 * @param date - Local date
 * @param minutes - Minutes from midnight in local time (0-1439)
 * @param timezone - IANA timezone string
 * @returns UTC date and minutes from midnight in UTC
 */
export function localToUTC(
  date: Date,
  minutes: number,
  timezone: string,
): { date: Date; minutes: number } {
  // Create a date string in the user's timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const timeStr = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;

  // Parse the local time
  const localDateStr = `${year}-${month}-${day}T${timeStr}`;
  const localDate = new Date(localDateStr);

  // Get timezone offset in minutes
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(localDate);
  const localParts: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      localParts[part.type] = part.value;
    }
  });

  // Create UTC date
  const utcDate = new Date(
    Date.UTC(
      parseInt(localParts.year),
      parseInt(localParts.month) - 1,
      parseInt(localParts.day),
      parseInt(localParts.hour),
      parseInt(localParts.minute),
      parseInt(localParts.second),
    ),
  );

  // Calculate the offset
  const offset = localDate.getTime() - utcDate.getTime();

  // Apply offset to get correct UTC time
  const correctedUTC = new Date(localDate.getTime() - offset);

  // Calculate UTC minutes from midnight
  const utcMinutes =
    correctedUTC.getUTCHours() * 60 + correctedUTC.getUTCMinutes();

  // Set the date part to midnight UTC for storage
  const storedDate = new Date(
    Date.UTC(year, date.getMonth(), date.getDate(), 0, 0, 0, 0),
  );

  return {
    date: storedDate,
    minutes: utcMinutes,
  };
}

/**
 * Converts UTC date and time to local timezone
 * @param date - UTC date
 * @param minutes - Minutes from midnight in UTC (0-1439)
 * @param timezone - IANA timezone string
 * @returns Local date and minutes from midnight in local time
 */
export function utcToLocal(
  date: Date,
  minutes: number,
  timezone: string,
): { date: Date; minutes: number } {
  const utcHours = Math.floor(minutes / 60);
  const utcMinutes = minutes % 60;

  // Create UTC timestamp
  const utcDate = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      utcHours,
      utcMinutes,
      0,
      0,
    ),
  );

  // Convert to local timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);
  const localParts: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      localParts[part.type] = part.value;
    }
  });

  const localDate = new Date(
    parseInt(localParts.year),
    parseInt(localParts.month) - 1,
    parseInt(localParts.day),
  );

  const localMinutes =
    parseInt(localParts.hour) * 60 + parseInt(localParts.minute);

  return {
    date: localDate,
    minutes: localMinutes,
  };
}

/**
 * Gets the user's current timezone
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Converts minutes from midnight to HH:MM format
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Converts HH:MM format to minutes from midnight
 */
export function timeStringToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * List of common IANA timezones
 */
export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "UTC",
];
