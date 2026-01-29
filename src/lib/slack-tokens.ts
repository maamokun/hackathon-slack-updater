import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { encryptToken, decryptToken } from "@/lib/crypto";

interface SlackTokenRefreshResponse {
  ok: boolean;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  error?: string;
}

/**
 * Refreshes a Slack OAuth token using the refresh token
 * @param refreshToken - The current refresh token (plaintext)
 * @returns New access token, refresh token, and expiration timestamp
 */
export async function refreshSlackToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data: SlackTokenRefreshResponse = await response.json();

  if (!data.ok || !data.access_token) {
    throw new Error(
      `Failed to refresh Slack token: ${data.error || "Unknown error"}`,
    );
  }

  // Calculate expiration time (subtract 5 minutes for safety buffer)
  const expiresAt = new Date(Date.now() + (data.expires_in - 300) * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

/**
 * Ensures an Organization has a fresh bot token, refreshing if necessary
 * @param organizationId - The organization ID
 * @returns Fresh decrypted access token
 */
export async function ensureFreshOrgToken(
  organizationId: string,
): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  // Check if token expires in less than 1 hour
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

  if (org.botTokenExpiresAt > oneHourFromNow) {
    // Token is still fresh, decrypt and return
    return decryptToken(org.botAccessToken);
  }

  // Token is expiring soon, refresh it
  console.log(`Refreshing bot token for organization ${organizationId}`);

  const currentRefreshToken = decryptToken(org.botRefreshToken);
  const { accessToken, refreshToken, expiresAt } =
    await refreshSlackToken(currentRefreshToken);

  // Encrypt and store new tokens
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      botAccessToken: encryptToken(accessToken),
      botRefreshToken: encryptToken(refreshToken),
      botTokenExpiresAt: expiresAt,
    },
  });

  return accessToken;
}

/**
 * Ensures an OrganizationMember has a fresh user token, refreshing if necessary
 * @param membershipId - The organization member ID
 * @returns Fresh decrypted access token
 */
export async function ensureFreshMemberToken(
  membershipId: string,
): Promise<string> {
  const member = await prisma.organizationMember.findUnique({
    where: { id: membershipId },
  });

  if (!member) {
    throw new Error("Organization member not found");
  }

  // Check if token expires in less than 1 hour
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

  if (member.userTokenExpiresAt > oneHourFromNow) {
    // Token is still fresh, decrypt and return
    return decryptToken(member.userAccessToken);
  }

  // Token is expiring soon, refresh it
  console.log(`Refreshing user token for member ${membershipId}`);

  const currentRefreshToken = decryptToken(member.userRefreshToken);
  const { accessToken, refreshToken, expiresAt } =
    await refreshSlackToken(currentRefreshToken);

  // Encrypt and store new tokens
  await prisma.organizationMember.update({
    where: { id: membershipId },
    data: {
      userAccessToken: encryptToken(accessToken),
      userRefreshToken: encryptToken(refreshToken),
      userTokenExpiresAt: expiresAt,
    },
  });

  return accessToken;
}
