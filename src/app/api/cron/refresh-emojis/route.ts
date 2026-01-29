import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchCustomEmojis } from "@/lib/slack-api";

/**
 * Vercel Cron endpoint to refresh custom emojis for all organizations
 * Runs daily to keep emoji cache up to date
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log(
      `[Emoji Cron] Starting emoji refresh at ${new Date().toISOString()}`,
    );

    // Get all organizations
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        slackTeamName: true,
        emojisLastFetched: true,
      },
    });

    console.log(
      `[Emoji Cron] Found ${organizations.length} organizations to refresh`,
    );

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Refresh emojis for each organization
    for (const org of organizations) {
      try {
        // Check if emojis were fetched recently (within last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (org.emojisLastFetched && org.emojisLastFetched > oneHourAgo) {
          console.log(
            `[Emoji Cron] Skipping ${org.slackTeamName} - updated recently`,
          );
          results.skipped++;
          continue;
        }

        console.log(`[Emoji Cron] Refreshing emojis for ${org.slackTeamName}`);
        await fetchCustomEmojis(org.id);
        results.success++;

        console.log(`[Emoji Cron] ✓ Refreshed emojis for ${org.slackTeamName}`);
      } catch (error) {
        results.failed++;
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`${org.slackTeamName}: ${errorMsg}`);
        console.error(
          `[Emoji Cron] ✗ Failed to refresh emojis for ${org.slackTeamName}:`,
          error,
        );
      }
    }

    console.log(
      `[Emoji Cron] Completed: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`,
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        totalOrganizations: organizations.length,
        refreshed: results.success,
        failed: results.failed,
        skipped: results.skipped,
      },
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    console.error("[Emoji Cron] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
