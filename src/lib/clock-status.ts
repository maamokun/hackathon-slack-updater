import { prisma } from "@/lib/db";
import { setUserPresence } from "@/lib/slack-api";

/**
 * Updates a user's clock status and manages their Slack presence
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
  channelId?: string
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

  // Update Slack presence for all user's organization memberships
  if (!isClockedIn) {
    // User clocked out - set presence to away for all their memberships
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
    });

    for (const membership of memberships) {
      try {
        await setUserPresence(membership.id, "away");
      } catch (error) {
        // Log warning but don't block clock-out operation
        console.warn(
          `Could not update presence for membership ${membership.id}:`,
          error instanceof Error ? error.message : "Unknown error",
          "- User may need to reinstall app with users:write scope"
        );
      }
    }
  } else {
    // User clocked in - set presence to auto for all their memberships
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
    });

    for (const membership of memberships) {
      try {
        await setUserPresence(membership.id, "auto");
      } catch (error) {
        // Log warning but don't block clock-in operation
        console.warn(
          `Could not update presence for membership ${membership.id}:`,
          error instanceof Error ? error.message : "Unknown error",
          "- User may need to reinstall app with users:write scope"
        );
      }
    }
  }

  console.log(
    `[ClockStatus] User ${userId} ${isClockedIn ? "clocked in" : "clocked out"} via ${method}`
  );
}

/**
 * Gets all users who are currently clocked in for an organization
 * @param organizationId - The organization ID
 * @returns Array of user IDs who are clocked in
 */
export async function getClockedInUsers(
  organizationId: string
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
