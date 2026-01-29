import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

interface SlackInteractivePayload {
  type: string;
  user: {
    id: string;
    username: string;
    name: string;
  };
  api_app_id: string;
  token: string;
  container: any;
  trigger_id: string;
  team: {
    id: string;
    domain: string;
  };
  response_url: string;
  actions?: Array<{
    action_id: string;
    block_id: string;
    value?: string;
    type: string;
  }>;
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
 * Handles Slack interactive components (buttons, menus, etc.)
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
      console.error("[Interactive] Invalid Slack signature");
      return NextResponse.json({ text: "Invalid signature" }, { status: 401 });
    }

    // Parse interactive payload (comes as URL-encoded with payload= prefix)
    const params = new URLSearchParams(body);
    const payloadStr = params.get("payload");
    if (!payloadStr) {
      return NextResponse.json({ text: "No payload found" }, { status: 400 });
    }

    const payload: SlackInteractivePayload = JSON.parse(payloadStr);

    // Handle block actions
    if (payload.type === "block_actions" && payload.actions) {
      for (const action of payload.actions) {
        if (action.action_id === "opt_out_invite") {
          // User clicked "Don't Show Again"
          const organizationId = action.value;

          if (!organizationId) {
            console.error("[Interactive] No organization ID in opt_out action");
            continue;
          }

          // Create opt-out record
          await prisma.dmOptOut.create({
            data: {
              slackUserId: payload.user.id,
              organizationId,
            },
          });

          console.log(
            `[Interactive] User ${payload.user.id} opted out of invites for org ${organizationId}`
          );

          // Update the message to confirm
          return NextResponse.json({
            replace_original: true,
            text: "✓ You won't receive any more invites.",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "✓ *Got it!* You won't receive any more invites from Status Scheduler.\n\nYou can always access the app by visiting your workspace's dashboard if you change your mind.",
                },
              },
            ],
          });
        }
      }
    }

    // Default response for unhandled actions
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Interactive] Error processing interaction:", error);
    return NextResponse.json(
      { text: "An error occurred" },
      { status: 500 }
    );
  }
}
