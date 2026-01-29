import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { updateClockStatus } from "@/lib/clock-status";

interface SlackCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  api_app_id: string;
  response_url: string;
  trigger_id: string;
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
 * Handles Slack slash commands (/clockin and /clockout)
 */
export async function POST(request: NextRequest) {
  try {
    // Get request body and headers
    const body = await request.text();
    const timestamp = request.headers.get("x-slack-request-timestamp");
    const signature = request.headers.get("x-slack-signature");

    if (!timestamp || !signature) {
      return NextResponse.json(
        { text: "Missing Slack signature headers" },
        { status: 401 }
      );
    }

    // Verify request came from Slack
    if (!verifySlackRequest(body, timestamp, signature)) {
      console.error("[Commands] Invalid Slack signature");
      return NextResponse.json({ text: "Invalid signature" }, { status: 401 });
    }

    // Parse command payload (URL-encoded)
    const params = new URLSearchParams(body);
    const payload: SlackCommandPayload = {
      token: params.get("token") || "",
      team_id: params.get("team_id") || "",
      team_domain: params.get("team_domain") || "",
      channel_id: params.get("channel_id") || "",
      channel_name: params.get("channel_name") || "",
      user_id: params.get("user_id") || "",
      user_name: params.get("user_name") || "",
      command: params.get("command") || "",
      text: params.get("text") || "",
      api_app_id: params.get("api_app_id") || "",
      response_url: params.get("response_url") || "",
      trigger_id: params.get("trigger_id") || "",
    };

    // Find organization by team ID
    const org = await prisma.organization.findUnique({
      where: { slackTeamId: payload.team_id },
      include: {
        members: {
          where: { slackUserId: payload.user_id },
        },
      },
    });

    if (!org) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "❌ This workspace hasn't installed the Status Scheduler app yet. Please ask an admin to install it.",
      });
    }

    const member = org.members[0];
    if (!member) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "❌ You need to connect your account first. Please visit the dashboard to get started.",
      });
    }

    // Handle the command
    const command = payload.command.toLowerCase();

    if (command === "/clockin") {
      await updateClockStatus(member.userId, true, "slash_command");

      return NextResponse.json({
        response_type: "ephemeral",
        text: "✅ You've clocked in! Your schedules are now active.",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "✅ *You've clocked in!*\n\nYour scheduled status updates are now active and your presence is set to online.",
            },
          },
        ],
      });
    } else if (command === "/clockout") {
      await updateClockStatus(member.userId, false, "slash_command");

      return NextResponse.json({
        response_type: "ephemeral",
        text: "✅ You've clocked out! Your presence has been set to away.",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "✅ *You've clocked out!*\n\nYour scheduled status updates are paused and your presence has been set to away.",
            },
          },
        ],
      });
    } else {
      return NextResponse.json({
        response_type: "ephemeral",
        text: `❌ Unknown command: ${command}`,
      });
    }
  } catch (error) {
    console.error("[Commands] Error processing command:", error);
    return NextResponse.json(
      {
        response_type: "ephemeral",
        text: "❌ An error occurred while processing your command. Please try again later.",
      },
      { status: 500 }
    );
  }
}
