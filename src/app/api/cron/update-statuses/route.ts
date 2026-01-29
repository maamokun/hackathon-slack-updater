import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { updateUserSlackStatus } from "@/lib/slack-api";

interface ActiveSchedule {
  id: string;
  userId: string;
  statusText: string;
  statusEmoji: string;
  membershipId: string;
  priority: number; // Higher priority schedules take precedence
}

/**
 * Vercel Cron endpoint to update user statuses based on active schedules
 * Runs every 5 minutes
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const currentDayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

    console.log(`[Cron] Starting status update at ${now.toISOString()}`);

    // Find all enabled schedules that are active right now
    const activeSchedules = await prisma.schedule.findMany({
      where: {
        enabled: true,
        // Date range check
        startDate: { lte: now },
        OR: [
          { endDate: null }, // No end date
          { endDate: { gte: now } }, // End date hasn't passed
        ],
      },
      include: {
        user: {
          include: {
            clockStatus: true,
          },
        },
        organization: {
          include: {
            members: true,
          },
        },
      },
    });

    console.log(`[Cron] Found ${activeSchedules.length} potentially active schedules`);

    // Filter schedules by time and recurrence pattern
    const filteredSchedules: ActiveSchedule[] = [];

    for (const schedule of activeSchedules) {
      // Check if current time is within the schedule's time range
      const isInTimeRange = isTimeInRange(
        currentMinutes,
        schedule.timeStart,
        schedule.timeEnd
      );

      if (!isInTimeRange) {
        continue;
      }

      // Check recurrence pattern
      const matchesRecurrence = matchesRecurrencePattern(
        currentDayOfWeek,
        schedule.recurring,
        schedule.recurringDays as number[] | null
      );

      if (!matchesRecurrence) {
        continue;
      }

      // Check if schedule requires user to be clocked in
      if (schedule.requiresClockedIn) {
        const clockStatus = schedule.user.clockStatus;
        const isClockedIn = clockStatus?.isClockedIn ?? false;

        if (!isClockedIn) {
          // User is not clocked in, skip this schedule
          continue;
        }
      }

      // Get the organization membership for this user
      const membership = schedule.organization.members.find(
        (member) => member.userId === schedule.userId
      );
      if (!membership) {
        console.warn(`[Cron] No membership found for user ${schedule.userId} in org ${schedule.organizationId}`);
        continue;
      }

      // Calculate priority (later start times have higher priority)
      const priority = schedule.timeStart;

      filteredSchedules.push({
        id: schedule.id,
        userId: schedule.userId,
        statusText: schedule.statusText,
        statusEmoji: schedule.statusEmoji,
        membershipId: membership.id,
        priority,
      });
    }

    console.log(`[Cron] ${filteredSchedules.length} schedules are currently active`);

    // Group by user and pick highest priority schedule for each user
    const schedulesByUser = new Map<string, ActiveSchedule>();

    for (const schedule of filteredSchedules) {
      const existing = schedulesByUser.get(schedule.userId);
      if (!existing || schedule.priority > existing.priority) {
        schedulesByUser.set(schedule.userId, schedule);
      }
    }

    console.log(`[Cron] Updating status for ${schedulesByUser.size} users`);

    // Update status for each user
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const [userId, schedule] of schedulesByUser) {
      try {
        await updateUserSlackStatus(
          schedule.membershipId,
          schedule.statusText,
          schedule.statusEmoji
        );
        results.success++;
        console.log(`[Cron] ✓ Updated status for user ${userId}`);
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`User ${userId}: ${errorMsg}`);
        console.error(`[Cron] ✗ Failed to update status for user ${userId}:`, error);
      }
    }

    console.log(`[Cron] Completed: ${results.success} success, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      stats: {
        totalSchedules: activeSchedules.length,
        activeSchedules: filteredSchedules.length,
        usersUpdated: results.success,
        failures: results.failed,
      },
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    console.error("[Cron] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Checks if the current time (in minutes) is within a schedule's time range
 * Handles ranges that cross midnight (e.g., 22:00 to 02:00)
 */
function isTimeInRange(
  currentMinutes: number,
  startMinutes: number,
  endMinutes: number
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
  recurringDays: number[] | null
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
