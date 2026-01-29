import { prisma } from "@/lib/db";
import {
  setUserPresence,
  clearUserSlackStatus,
  updateUserSlackStatus,
} from "@/lib/slack-api";

/**
 * Checks if the current time (in minutes) is within a schedule's time range
 * Handles ranges that cross midnight (e.g., 22:00 to 02:00)
 */
function isTimeInRange(
  currentMinutes: number,
  startMinutes: number,
  endMinutes: number,
): boolean {
  if (startMinutes <= endMinutes) {
    // Normal range (doesn't cross midnight)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Range crosses midnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Checks if the current day matches the schedule's recurrence pattern
 */
function matchesRecurrencePattern(
  currentDay: number,
  recurring: string,
  recurringDays: number[] | null,
): boolean {
  switch (recurring) {
    case "none":
      return true; // Single occurrence, already checked by date range

    case "daily":
      return true; // Every day

    case "weekdays":
      return currentDay >= 1 && currentDay <= 5; // Monday-Friday

    case "weekends":
      return currentDay === 0 || currentDay === 6; // Saturday-Sunday

    case "custom":
      return recurringDays ? recurringDays.includes(currentDay) : false;

    default:
      return false;
  }
}

/**
 * Finds the active schedule for a user at the current time
 * Returns the highest priority (latest start time) active schedule
 */
async function findActiveSchedule(userId: string) {
  const now = new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const currentDayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

  // Find all enabled schedules for this user
  const schedules = await prisma.schedule.findMany({
    where: {
      userId,
      enabled: true,
      // Date range check
      startDate: { lte: now },
      OR: [
        { endDate: null }, // No end date
        { endDate: { gte: now } }, // End date hasn't passed
      ],
      // Must not require clocked in (since we're checking this while clocking in)
      requiresClockedIn: false,
    },
    include: {
      organization: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  let activeSchedule = null;
  let highestPriority = -1;

  for (const schedule of schedules) {
    // Check if current time is within the schedule's time range
    const isInTimeRange = isTimeInRange(
      currentMinutes,
      schedule.timeStart,
      schedule.timeEnd,
    );

    if (!isInTimeRange) {
      continue;
    }

    // Check recurrence pattern
    const matchesRecurrence = matchesRecurrencePattern(
      currentDayOfWeek,
      schedule.recurring,
      schedule.recurringDays as number[] | null,
    );

    if (!matchesRecurrence) {
      continue;
    }

    // Get membership
    const membership = schedule.organization.members[0];
    if (!membership) {
      continue;
    }

    // Calculate priority (later start times have higher priority)
    const priority = schedule.timeStart;

    if (priority > highestPriority) {
      highestPriority = priority;
      activeSchedule = {
        statusText: schedule.statusText,
        statusEmoji: schedule.statusEmoji,
        membershipId: membership.id,
      };
    }
  }

  return activeSchedule;
}

/**
 * Updates a user's clock status and manages their Slack presence and status emoji
 * @param userId - The user ID
 * @param isClockedIn - Whether the user is clocking in (true) or out (false)
 * @param method - How the status was changed ("message" | "manual" | "slash_command")
 * @param messageTs - Optional message timestamp (for message-based events)
 * @param channelId - Optional channel ID (for message-based events)
 */
export async function updateClockStatus(
  userId: string,
  isClockedIn: boolean,
  method: "message" | "manual" | "slash_command",
  messageTs?: string,
  channelId?: string,
): Promise<void> {
  const now = new Date();

  // Upsert clock status
  await prisma.clockStatus.upsert({
    where: { userId },
    create: {
      userId,
      isClockedIn,
      lastClockIn: isClockedIn ? now : null,
      lastClockOut: isClockedIn ? null : now,
      lastUpdatedBy: method,
    },
    update: {
      isClockedIn,
      lastClockIn: isClockedIn ? now : undefined,
      lastClockOut: isClockedIn ? undefined : now,
      lastUpdatedBy: method,
      updatedAt: now,
    },
  });

  // Create clock event record
  await prisma.clockEvent.create({
    data: {
      userId,
      action: isClockedIn ? "clock_in" : "clock_out",
      method,
      timestamp: now,
      messageTs: messageTs || null,
      channelId: channelId || null,
    },
  });

  // Get all user's organization memberships
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
  });

  // Update Slack presence and status emoji for all memberships
  if (!isClockedIn) {
    // User clocked out - set presence to away and clear status emoji
    for (const membership of memberships) {
      try {
        await setUserPresence(membership.id, "away");
      } catch (error) {
        console.warn(
          `Could not update presence for membership ${membership.id}:`,
          error instanceof Error ? error.message : "Unknown error",
          "- User may need to reinstall app with users:write scope",
        );
      }

      try {
        await clearUserSlackStatus(membership.id);
      } catch (error) {
        console.warn(
          `Could not clear status for membership ${membership.id}:`,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }
  } else {
    // User clocked in - set presence to auto and check for active schedules
    for (const membership of memberships) {
      try {
        await setUserPresence(membership.id, "auto");
      } catch (error) {
        console.warn(
          `Could not update presence for membership ${membership.id}:`,
          error instanceof Error ? error.message : "Unknown error",
          "- User may need to reinstall app with users:write scope",
        );
      }
    }

    // Check if there's an active schedule and apply its emoji
    const activeSchedule = await findActiveSchedule(userId);
    if (activeSchedule) {
      try {
        await updateUserSlackStatus(
          activeSchedule.membershipId,
          activeSchedule.statusText,
          activeSchedule.statusEmoji,
        );
        console.log(
          `[ClockStatus] Applied active schedule emoji for user ${userId}`,
        );
      } catch (error) {
        console.warn(
          `Could not apply active schedule emoji for user ${userId}:`,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }
  }

  console.log(
    `[ClockStatus] User ${userId} ${isClockedIn ? "clocked in" : "clocked out"} via ${method}`,
  );
}

/**
 * Gets all users who are currently clocked in for an organization
 * @param organizationId - The organization ID
 * @returns Array of user IDs who are clocked in
 */
export async function getClockedInUsers(
  organizationId: string,
): Promise<string[]> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    include: {
      user: {
        include: {
          clockStatus: true,
        },
      },
    },
  });

  return members
    .filter((member) => member.user.clockStatus?.isClockedIn === true)
    .map((member) => member.userId);
}

/**
 * Checks if a user is currently clocked in
 * @param userId - The user ID
 * @returns true if clocked in, false otherwise
 */
export async function isUserClockedIn(userId: string): Promise<boolean> {
  const status = await prisma.clockStatus.findUnique({
    where: { userId },
  });

  return status?.isClockedIn ?? false; // Default to false if no status record
}
