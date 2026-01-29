import { prisma } from "@/lib/db";
import { sign } from "jsonwebtoken";
import { env } from "@/lib/env";

interface SlackChatPostMessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
}

/**
 * Generates a signed JWT token for the join URL
 * @param slackUserId - The Slack user ID
 * @param organizationId - The organization ID
 * @returns JWT token valid for 24 hours
 */
function generateJoinToken(slackUserId: string, organizationId: string): string {
  return sign(
    {
      slackUserId,
      organizationId,
      type: "join_invite",
    },
    env.TOKEN_ENCRYPTION_KEY,
    { expiresIn: "24h" }
  );
}

/**
 * Sends an invite DM to a non-member user
 * @param slackUserId - The Slack user ID to send the DM to
 * @param organizationId - The organization ID
 * @param botToken - The bot access token for the organization
 */
export async function sendInviteDm(
  slackUserId: string,
  organizationId: string,
  botToken: string
): Promise<void> {
  try {
    // Check if user has opted out of DMs for this org
    const optOut = await prisma.dmOptOut.findUnique({
      where: {
        slackUserId_organizationId: {
          slackUserId,
          organizationId,
        },
      },
    });

    if (optOut) {
      console.log(
        `[DM] User ${slackUserId} has opted out of invites for org ${organizationId}`
      );
      return;
    }

    // Get organization info
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slackTeamName: true },
    });

    if (!org) {
      console.error(`[DM] Organization ${organizationId} not found`);
      return;
    }

    // Generate join token
    const token = generateJoinToken(slackUserId, organizationId);
    const joinUrl = `${env.NEXT_PUBLIC_BASE_URL}/join/${organizationId}?token=${token}`;

    // Send DM with interactive blocks
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: slackUserId,
        text: `Hi! You can use the Status Scheduler app for ${org.slackTeamName}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `👋 Hi there! I noticed you used a clock-in/out keyword in *${org.slackTeamName}*.\n\nStatus Scheduler helps you automatically manage your Slack status based on your schedule. Want to give it a try?`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Get Started",
                },
                style: "primary",
                url: joinUrl,
                action_id: "join_invite",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Don't Show Again",
                },
                action_id: "opt_out_invite",
                value: organizationId,
              },
            ],
          },
        ],
      }),
    });

    const data: SlackChatPostMessageResponse = await response.json();

    if (!data.ok) {
      console.error(`[DM] Failed to send invite: ${data.error}`);
    } else {
      console.log(`[DM] Sent invite to user ${slackUserId}`);
    }
  } catch (error) {
    console.error("[DM] Error sending invite:", error);
  }
}
