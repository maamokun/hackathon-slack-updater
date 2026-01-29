"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

interface CreateScheduleInput {
  organizationId: string;
  name: string;
  startDate: Date;
  endDate?: Date;
  timeStart: number; // minutes from midnight (0-1439)
  timeEnd: number; // minutes from midnight (0-1439)
  timezone: string;
  statusText: string;
  statusEmoji: string;
  recurring: "none" | "daily" | "weekdays" | "weekends" | "custom";
  recurringDays?: number[]; // 0-6 (Sunday-Saturday)
  requiresClockedIn?: boolean; // Only activate when user is clocked in
}

interface UpdateScheduleInput extends Partial<CreateScheduleInput> {
  id: string;
  enabled?: boolean;
}

/**
 * Verifies that the user is authenticated and is a member of the organization
 */
async function verifyMembership(organizationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    throw new Error("Unauthorized: Not a member of this organization");
  }

  return { session, membership };
}

/**
 * Creates a new schedule for the authenticated user
 */
export async function createSchedule(input: CreateScheduleInput) {
  const { session } = await verifyMembership(input.organizationId);

  // Validate time ranges
  if (input.timeStart < 0 || input.timeStart > 1439) {
    throw new Error("Invalid timeStart: must be between 0 and 1439");
  }

  if (input.timeEnd < 0 || input.timeEnd > 1439) {
    throw new Error("Invalid timeEnd: must be between 0 and 1439");
  }

  // Validate recurring days for custom recurrence
  if (input.recurring === "custom") {
    if (!input.recurringDays || input.recurringDays.length === 0) {
      throw new Error("Custom recurrence requires at least one day selected");
    }

    if (input.recurringDays.some((day) => day < 0 || day > 6)) {
      throw new Error(
        "Invalid recurring day: must be between 0 (Sunday) and 6 (Saturday)",
      );
    }
  }

  const schedule = await prisma.schedule.create({
    data: {
      userId: session.user.id,
      organizationId: input.organizationId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      timeStart: input.timeStart,
      timeEnd: input.timeEnd,
      timezone: input.timezone,
      statusText: input.statusText,
      statusEmoji: input.statusEmoji,
      recurring: input.recurring,
      recurringDays: input.recurringDays ?? undefined,
      requiresClockedIn: input.requiresClockedIn ?? false,
      enabled: true,
    },
  });

  revalidatePath("/dashboard");
  return schedule;
}

/**
 * Updates an existing schedule
 */
export async function updateSchedule(input: UpdateScheduleInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  // Find the schedule and verify ownership
  const schedule = await prisma.schedule.findUnique({
    where: { id: input.id },
    include: { organization: true },
  });

  if (!schedule) {
    throw new Error("Schedule not found");
  }

  if (schedule.userId !== session.user.id) {
    throw new Error("Unauthorized: You can only edit your own schedules");
  }

  // Verify membership
  await verifyMembership(schedule.organizationId);

  // Validate time ranges if provided
  if (
    input.timeStart !== undefined &&
    (input.timeStart < 0 || input.timeStart > 1439)
  ) {
    throw new Error("Invalid timeStart: must be between 0 and 1439");
  }

  if (
    input.timeEnd !== undefined &&
    (input.timeEnd < 0 || input.timeEnd > 1439)
  ) {
    throw new Error("Invalid timeEnd: must be between 0 and 1439");
  }

  // Validate recurring days for custom recurrence
  if (input.recurring === "custom") {
    if (!input.recurringDays || input.recurringDays.length === 0) {
      throw new Error("Custom recurrence requires at least one day selected");
    }
  }

  const updatedSchedule = await prisma.schedule.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate !== undefined && { endDate: input.endDate }),
      ...(input.timeStart !== undefined && { timeStart: input.timeStart }),
      ...(input.timeEnd !== undefined && { timeEnd: input.timeEnd }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.statusText !== undefined && { statusText: input.statusText }),
      ...(input.statusEmoji !== undefined && {
        statusEmoji: input.statusEmoji,
      }),
      ...(input.recurring !== undefined && { recurring: input.recurring }),
      ...(input.recurringDays !== undefined && {
        recurringDays: input.recurringDays,
      }),
      ...(input.requiresClockedIn !== undefined && {
        requiresClockedIn: input.requiresClockedIn,
      }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
    },
  });

  revalidatePath("/dashboard");
  return updatedSchedule;
}

/**
 * Deletes a schedule
 */
export async function deleteSchedule(scheduleId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  // Find the schedule and verify ownership
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) {
    throw new Error("Schedule not found");
  }

  if (schedule.userId !== session.user.id) {
    throw new Error("Unauthorized: You can only delete your own schedules");
  }

  await prisma.schedule.delete({
    where: { id: scheduleId },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Gets all schedules for the authenticated user in an organization
 */
export async function getSchedules(organizationId: string) {
  const { session } = await verifyMembership(organizationId);

  const schedules = await prisma.schedule.findMany({
    where: {
      organizationId,
      userId: session.user.id,
    },
    orderBy: {
      startDate: "asc",
    },
  });

  return schedules;
}

/**
 * Gets all members of an organization (owner only)
 */
export async function getOrganizationMembers(organizationId: string) {
  const { session, membership } = await verifyMembership(organizationId);

  if (membership.role !== "owner") {
    throw new Error("Unauthorized: Only organization owners can view members");
  }

  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return members;
}

/**
 * Removes a member from an organization (owner only)
 */
export async function removeOrganizationMember(memberId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  // Find the member to be removed
  const memberToRemove = await prisma.organizationMember.findUnique({
    where: { id: memberId },
  });

  if (!memberToRemove) {
    throw new Error("Member not found");
  }

  // Verify the current user is an owner
  const currentUserMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: memberToRemove.organizationId,
        userId: session.user.id,
      },
    },
  });

  if (!currentUserMembership || currentUserMembership.role !== "owner") {
    throw new Error(
      "Unauthorized: Only organization owners can remove members",
    );
  }

  // Don't allow removing the last owner
  if (memberToRemove.role === "owner") {
    const ownerCount = await prisma.organizationMember.count({
      where: {
        organizationId: memberToRemove.organizationId,
        role: "owner",
      },
    });

    if (ownerCount === 1) {
      throw new Error("Cannot remove the last owner of the organization");
    }
  }

  await prisma.organizationMember.delete({
    where: { id: memberId },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Gets the user's organizations
 */
export async function getUserOrganizations() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    include: {
      organization: true,
    },
  });

  return memberships.map((m) => ({
    ...m.organization,
    role: m.role,
  }));
}
