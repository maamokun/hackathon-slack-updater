import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { encryptToken } from "@/lib/crypto";

interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    name: string;
    id: string;
  };
  enterprise: {
    name: string;
    id: string;
  } | null;
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
    refresh_token?: string;
    expires_in?: number;
  };
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

/**
 * Handles the OAuth callback from Slack workspace installation
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/dashboard?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/dashboard?error=no_code`
    );
  }

  // Get the current user session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/sign-in?error=not_authenticated`
    );
  }

  try {
    // Exchange code for tokens
    const redirectUri = `${request.nextUrl.origin}/api/slack/install/callback`;
    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data: SlackOAuthResponse = await tokenResponse.json();

    if (!data.ok || !data.access_token) {
      throw new Error(data.error || "Failed to exchange code for token");
    }

    // Calculate expiration times
    const botExpiresAt = data.expires_in
      ? new Date(Date.now() + (data.expires_in - 300) * 1000)
      : new Date(Date.now() + 12 * 60 * 60 * 1000); // Default 12 hours

    const userExpiresAt = data.authed_user.expires_in
      ? new Date(Date.now() + (data.authed_user.expires_in - 300) * 1000)
      : new Date(Date.now() + 12 * 60 * 60 * 1000);

    // Check if organization already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slackTeamId: data.team.id },
    });

    if (existingOrg) {
      // Update existing organization with new tokens
      await prisma.organization.update({
        where: { id: existingOrg.id },
        data: {
          botAccessToken: encryptToken(data.access_token),
          botRefreshToken: encryptToken(data.refresh_token || ""),
          botTokenExpiresAt: botExpiresAt,
        },
      });

      // Check if user is already a member
      const existingMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: existingOrg.id,
            userId: session.user.id,
          },
        },
      });

      if (!existingMember) {
        // Add user as a member
        await prisma.organizationMember.create({
          data: {
            organizationId: existingOrg.id,
            userId: session.user.id,
            slackUserId: data.authed_user.id,
            userAccessToken: encryptToken(data.authed_user.access_token),
            userRefreshToken: encryptToken(data.authed_user.refresh_token || ""),
            userTokenExpiresAt: userExpiresAt,
            role: "member",
          },
        });
      } else {
        // Update existing member tokens
        await prisma.organizationMember.update({
          where: { id: existingMember.id },
          data: {
            userAccessToken: encryptToken(data.authed_user.access_token),
            userRefreshToken: encryptToken(data.authed_user.refresh_token || ""),
            userTokenExpiresAt: userExpiresAt,
          },
        });
      }

      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard?success=reinstalled`
      );
    }

    // Create new organization
    const organization = await prisma.organization.create({
      data: {
        slackTeamId: data.team.id,
        slackTeamName: data.team.name,
        botAccessToken: encryptToken(data.access_token),
        botRefreshToken: encryptToken(data.refresh_token || ""),
        botTokenExpiresAt: botExpiresAt,
        installedBy: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            slackUserId: data.authed_user.id,
            userAccessToken: encryptToken(data.authed_user.access_token),
            userRefreshToken: encryptToken(data.authed_user.refresh_token || ""),
            userTokenExpiresAt: userExpiresAt,
            role: "owner",
          },
        },
      },
    });

    // Fetch and cache custom emojis in the background (don't block redirect)
    fetchAndCacheEmojis(organization.id).catch(console.error);

    return NextResponse.redirect(
      `${request.nextUrl.origin}/dashboard?success=installed&org=${organization.id}`
    );
  } catch (error) {
    console.error("Slack installation error:", error);
    return NextResponse.redirect(
      `${request.nextUrl.origin}/dashboard?error=installation_failed`
    );
  }
}

/**
 * Fetches custom emojis from Slack and caches them in the database
 */
async function fetchAndCacheEmojis(organizationId: string) {
  try {
    const { ensureFreshOrgToken } = await import("@/lib/slack-tokens");

    const accessToken = await ensureFreshOrgToken(organizationId);

    const response = await fetch("https://slack.com/api/emoji.list", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (data.ok && data.emoji) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          customEmojis: data.emoji,
          emojisLastFetched: new Date(),
        },
      });

      console.log(`Cached ${Object.keys(data.emoji).length} custom emojis for org ${organizationId}`);
    }
  } catch (error) {
    console.error("Failed to fetch custom emojis:", error);
  }
}
