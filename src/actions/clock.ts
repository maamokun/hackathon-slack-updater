"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { updateClockStatus } from "@/lib/clock-status";
import { revalidatePath } from "next/cache";

/**
 * Gets the clock configuration for an organization
 */
export async function getClockConfig(organizationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  // Verify membership
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

  // Get clock config
  const config = await prisma.clockConfig.findUnique({
    where: { organizationId },
  });

  return config;
}

interface UpdateClockConfigInput {
  organizationId: string;
  channelId: string;
  channelName: string;
  clockInKeywords: string[];
  clockInEmoji: string;
  clockOutKeywords: string[];
  clockOutEmoji: string;
  enabled: boolean;
}

/**
 * Updates or creates clock configuration for an organization (owner only)
 */
export async function updateClockConfig(input: UpdateClockConfigInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  // Verify membership and owner role
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    throw new Error("Unauthorized: Not a member of this organization");
  }

  if (membership.role !== "owner") {
    throw new Error("Unauthorized: Only owners can modify clock configuration");
  }

  // Validate keywords
  if (input.clockInKeywords.length === 0) {
    throw new Error("At least one clock-in keyword is required");
  }

  if (input.clockOutKeywords.length === 0) {
    throw new Error("At least one clock-out keyword is required");
  }

  // Upsert clock config
  const config = await prisma.clockConfig.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      channelId: input.channelId,
      channelName: input.channelName,
      clockInKeywords: input.clockInKeywords,
      clockInEmoji: input.clockInEmoji,
      clockOutKeywords: input.clockOutKeywords,
      clockOutEmoji: input.clockOutEmoji,
      enabled: input.enabled,
    },
    update: {
      channelId: input.channelId,
      channelName: input.channelName,
      clockInKeywords: input.clockInKeywords,
      clockInEmoji: input.clockInEmoji,
      clockOutKeywords: input.clockOutKeywords,
      clockOutEmoji: input.clockOutEmoji,
      enabled: input.enabled,
    },
  });

  revalidatePath("/dashboard");

  return config;
}

/**
 * Gets the current user's clock status
 */
export async function getUserClockStatus() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  const status = await prisma.clockStatus.findUnique({
    where: { userId: session.user.id },
  });

  // Return default status if not found
  return (
    status || {
      isClockedIn: false,
      lastClockIn: null,
      lastClockOut: null,
      lastUpdatedBy: null,
    }
  );
}

/**
 * Manually toggles the current user's clock status
 */
export async function toggleUserClockStatus() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  // Get current status
  const currentStatus = await prisma.clockStatus.findUnique({
    where: { userId: session.user.id },
  });

  const newStatus = !(currentStatus?.isClockedIn ?? false);

  // Update clock status
  await updateClockStatus(session.user.id, newStatus, "manual");

  revalidatePath("/dashboard");

  return {
    isClockedIn: newStatus,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Gets clock event history for the current user
 */
export async function getUserClockHistory(limit: number = 50) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  const events = await prisma.clockEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return events;
}

/**
 * Gets list of Slack channels for an organization (for the channel selector)
 */
export async function getOrganizationChannels(organizationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  // Verify membership and owner role
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

  if (membership.role !== "owner") {
    throw new Error("Unauthorized: Only owners can view channels");
  }

  // Get organization with bot token
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  // Fetch channels from Slack API
  const { ensureFreshOrgToken } = await import("@/lib/slack-tokens");
  const botToken = await ensureFreshOrgToken(organizationId);

  const response = await fetch(
    "https://slack.com/api/conversations.list?types=public_channel&limit=200",
    {
      headers: {
        Authorization: `Bearer ${botToken}`,
      },
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to fetch channels: ${data.error}`);
  }

  return data.channels.map((channel: any) => ({
    id: channel.id,
    name: channel.name,
  }));
}
