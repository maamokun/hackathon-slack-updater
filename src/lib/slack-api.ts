import {
  ensureFreshMemberToken,
  ensureFreshOrgToken,
} from "@/lib/slack-tokens";
import { prisma } from "@/lib/db";

interface SlackProfileSetResponse {
  ok: boolean;
  profile?: {
    status_text: string;
    status_emoji: string;
    status_expiration: number;
  };
  error?: string;
}

interface SlackEmojiListResponse {
  ok: boolean;
  emoji?: Record<string, string>;
  error?: string;
}

/**
 * Updates a user's Slack status
 * @param membershipId - The organization member ID
 * @param statusText - The status text to set
 * @param statusEmoji - The status emoji (in :emoji: format)
 * @param expirationMinutes - Optional expiration time in minutes
 */
export async function updateUserSlackStatus(
  membershipId: string,
  statusText: string,
  statusEmoji: string,
  expirationMinutes?: number,
) {
  try {
    // Get fresh token for the user
    const accessToken = await ensureFreshMemberToken(membershipId);

    // Calculate expiration timestamp if provided
    const statusExpiration = expirationMinutes
      ? Math.floor(Date.now() / 1000) + expirationMinutes * 60
      : 0;

    const response = await fetch("https://slack.com/api/users.profile.set", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        profile: {
          status_text: statusText,
          status_emoji: statusEmoji,
          ...(statusExpiration > 0 && { status_expiration: statusExpiration }),
        },
      }),
    });

    const data: SlackProfileSetResponse = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data;
  } catch (error) {
    console.error(`Failed to update status for member ${membershipId}:`, error);
    throw error;
  }
}

/**
 * Clears a user's Slack status
 * @param membershipId - The organization member ID
 */
export async function clearUserSlackStatus(membershipId: string) {
  return updateUserSlackStatus(membershipId, "", "");
}

/**
 * Sets a user's Slack presence
 * @param membershipId - The organization member ID
 * @param presence - The presence to set ("auto" | "away")
 */
export async function setUserPresence(
  membershipId: string,
  presence: "auto" | "away",
): Promise<void> {
  try {
    const accessToken = await ensureFreshMemberToken(membershipId);

    const response = await fetch("https://slack.com/api/users.setPresence", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        presence,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }
  } catch (error) {
    console.error(`Failed to set presence for member ${membershipId}:`, error);
    throw error;
  }
}

/**
 * Fetches custom emojis from Slack workspace
 * @param organizationId - The organization ID
 * @returns Object mapping emoji names to URLs
 */
export async function fetchCustomEmojis(
  organizationId: string,
): Promise<Record<string, string>> {
  try {
    const accessToken = await ensureFreshOrgToken(organizationId);

    const response = await fetch("https://slack.com/api/emoji.list", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data: SlackEmojiListResponse = await response.json();

    if (!data.ok || !data.emoji) {
      throw new Error(
        `Failed to fetch emojis: ${data.error || "Unknown error"}`,
      );
    }

    // Update cache in database
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        customEmojis: data.emoji,
        emojisLastFetched: new Date(),
      },
    });

    console.log(
      `Cached ${Object.keys(data.emoji).length} custom emojis for org ${organizationId}`,
    );

    return data.emoji;
  } catch (error) {
    console.error("Failed to fetch custom emojis:", error);
    throw error;
  }
}

/**
 * Gets custom emojis from cache or fetches if stale
 * @param organizationId - The organization ID
 * @param maxAgeHours - Maximum age of cache in hours (default: 24)
 */
export async function getCustomEmojis(
  organizationId: string,
  maxAgeHours: number = 24,
): Promise<Record<string, string>> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      customEmojis: true,
      emojisLastFetched: true,
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  // Check if cache is fresh
  const cacheAge = org.emojisLastFetched
    ? Date.now() - org.emojisLastFetched.getTime()
    : Infinity;

  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  if (org.customEmojis && cacheAge < maxAgeMs) {
    // Return cached emojis
    return org.customEmojis as Record<string, string>;
  }

  // Cache is stale or missing, fetch fresh data
  return fetchCustomEmojis(organizationId);
}
