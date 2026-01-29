"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getCustomEmojis, fetchCustomEmojis } from "@/lib/slack-api";
import { revalidatePath } from "next/cache";

/**
 * Gets custom emojis for an organization
 */
export async function getOrganizationEmojis(organizationId: string) {
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

  // Get custom emojis (from cache or fetch)
  const customEmojis = await getCustomEmojis(organizationId);

  return customEmojis;
}

/**
 * Manually refreshes custom emojis for an organization (bypasses cache)
 */
export async function refreshOrganizationEmojis(organizationId: string) {
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

  // Force refresh emojis from Slack API
  const customEmojis = await fetchCustomEmojis(organizationId);

  // Revalidate any cached pages
  revalidatePath("/dashboard");

  return {
    success: true,
    count: Object.keys(customEmojis).length,
    timestamp: new Date().toISOString(),
  };
}
