import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { updateClockStatus } from "@/lib/clock-status";
import { sendInviteDm } from "@/lib/slack-dm";
import { ensureFreshOrgToken } from "@/lib/slack-tokens";

interface SlackEvent {
  type: string;
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  [key: string]: any;
}

interface SlackEventPayload {
  type: string;
  token?: string;
  challenge?: string;
  team_id?: string;
  event?: SlackEvent;
  event_id?: string;
}

/**
 * Verifies that the request came from Slack using HMAC signature
 */
function verifySlackRequest(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  // Reject old requests (older than 5 minutes)
  const requestTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - requestTime) > 60 * 5) {
    return false;
  }

  // Create signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = createHmac("sha256", env.SLACK_SIGNING_SECRET);
  hmac.update(sigBasestring);
  const computedSignature = `v0=${hmac.digest("hex")}`;

  // Use timing-safe comparison
  try {
    return timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

/**
 * Adds an emoji reaction to a Slack message
 */
async function addReaction(
  accessToken: string,
  channel: string,
  timestamp: string,
  emoji: string
): Promise<void> {
  // Remove colons from emoji if present
  const emojiName = emoji.replace(/:/g, "");

  const response = await fetch("https://slack.com/api/reactions.add", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      timestamp,
      name: emojiName,
    }),
  });

  const data = await response.json();
  if (!data.ok && data.error !== "already_reacted") {
    console.error(`Failed to add reaction: ${data.error}`);
  }
}

/**
 * Checks if a message contains any of the keywords (case-insensitive, partial match)
 */
function containsKeyword(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
}

/**
 * Webhook endpoint for Slack Events API
 */
export async function POST(request: NextRequest) {
  try {
    // Get request body and headers
    const body = await request.text();
    const timestamp = request.headers.get("x-slack-request-timestamp");
    const signature = request.headers.get("x-slack-signature");

    if (!timestamp || !signature) {
      return NextResponse.json(
        { error: "Missing Slack signature headers" },
        { status: 401 }
      );
    }

    // Verify request came from Slack
    if (!verifySlackRequest(body, timestamp, signature)) {
      console.error("[Events] Invalid Slack signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse payload
    const payload: SlackEventPayload = JSON.parse(body);

    // Handle URL verification challenge
    if (payload.type === "url_verification") {
      return NextResponse.json({ challenge: payload.challenge });
    }

    // Handle event callbacks
    if (payload.type === "event_callback" && payload.event) {
      const event = payload.event;

      // Only process channel messages
      if (event.type === "message" && event.channel && event.user && event.text) {
        // Skip bot messages and threaded replies
        if (event.subtype || event.thread_ts) {
          return NextResponse.json({ ok: true });
        }

        await handleMessageEvent(
          payload.team_id!,
          event.channel,
          event.user,
          event.text,
          event.ts!
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Events] Error processing event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handles a message event - checks keywords, adds reactions, updates clock status
 */
async function handleMessageEvent(
  teamId: string,
  channelId: string,
  slackUserId: string,
  text: string,
  messageTs: string
): Promise<void> {
  try {
    // Find organization by Slack team ID
    const org = await prisma.organization.findUnique({
      where: { slackTeamId: teamId },
      include: {
        clockConfig: true,
        members: {
          where: { slackUserId },
        },
      },
    });

    if (!org || !org.clockConfig) {
      // No org found or clock config not set up
      return;
    }

    const config = org.clockConfig;

    // Check if this message is in the monitored channel
    if (config.channelId !== channelId || !config.enabled) {
      return;
    }

    // Parse keywords from JSON
    const clockInKeywords = config.clockInKeywords as string[];
    const clockOutKeywords = config.clockOutKeywords as string[];

    // Check for keywords
    const hasClockIn = containsKeyword(text, clockInKeywords);
    const hasClockOut = containsKeyword(text, clockOutKeywords);

    // If no keywords match, ignore
    if (!hasClockIn && !hasClockOut) {
      return;
    }

    // Clock-in takes precedence if both match
    const action = hasClockIn ? "clock_in" : "clock_out";
    const emoji = hasClockIn ? config.clockInEmoji : config.clockOutEmoji;

    // Get org bot token for adding reactions
    const botToken = await ensureFreshOrgToken(org.id);

    // Add reaction to the message (for all users)
    await addReaction(botToken, channelId, messageTs, emoji);

    // Check if user is an org member
    const member = org.members[0];

    if (member) {
      // User is an org member - update their clock status
      await updateClockStatus(
        member.userId,
        action === "clock_in",
        "message",
        messageTs,
        channelId
      );

      console.log(
        `[Events] Updated clock status for member ${member.userId}: ${action}`
      );
    } else {
      // User is not an org member - send invite DM
      await sendInviteDm(slackUserId, org.id, botToken);

      console.log(
        `[Events] Sent invite DM to non-member user ${slackUserId} in org ${org.id}`
      );
    }
  } catch (error) {
    console.error("[Events] Error handling message event:", error);
  }
}
