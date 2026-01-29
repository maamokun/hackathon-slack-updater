import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Redirects to Slack OAuth for workspace installation
 * This is separate from user login and requests bot-level scopes
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const redirectUri = `${request.nextUrl.origin}/api/slack/install/callback`;

  // Bot scopes needed for workspace-level operations
  const botScopes = [
    "emoji:read", // Read workspace custom emojis
    "channels:history", // Read messages in public channels
    "channels:read", // View basic channel info
    "reactions:write", // Add emoji reactions to messages
    "chat:write", // Send DMs to users
    "commands", // Register slash commands
    "users:read", // Get user info for DMs
  ].join(",");

  // User scopes for the installing user
  const userScopes = [
    "users.profile:write", // Update user's own status
    "users:write", // Set user's presence (online/away)
    "emoji:read", // Read workspace custom emojis as the user
  ].join(",");

  const slackAuthUrl = new URL("https://slack.com/oauth/v2/authorize");
  slackAuthUrl.searchParams.set("client_id", env.SLACK_CLIENT_ID);
  slackAuthUrl.searchParams.set("scope", botScopes);
  slackAuthUrl.searchParams.set("user_scope", userScopes);
  slackAuthUrl.searchParams.set("redirect_uri", redirectUri);

  // Pass through any state for security/routing
  const state = searchParams.get("state");
  if (state) {
    slackAuthUrl.searchParams.set("state", state);
  }

  return NextResponse.redirect(slackAuthUrl.toString());
}
