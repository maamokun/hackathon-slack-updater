import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ClockConfigForm } from "@/components/clock/clock-config-form";

interface SettingsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { orgId } = await params;

  // Get session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  // Get organization and membership
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: session.user.id,
      },
    },
    include: {
      organization: {
        include: {
          clockConfig: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/dashboard");
  }

  const isOwner = membership.role === "owner";

  // Transform clock config to match the expected type
  const clockConfig = membership.organization.clockConfig
    ? {
        id: membership.organization.clockConfig.id,
        channelId: membership.organization.clockConfig.channelId,
        channelName: membership.organization.clockConfig.channelName,
        clockInKeywords: membership.organization.clockConfig
          .clockInKeywords as string[],
        clockInEmoji: membership.organization.clockConfig.clockInEmoji,
        clockOutKeywords: membership.organization.clockConfig
          .clockOutKeywords as string[],
        clockOutEmoji: membership.organization.clockConfig.clockOutEmoji,
        enabled: membership.organization.clockConfig.enabled,
      }
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold">Organization Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            {membership.organization.slackTeamName}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isOwner ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-medium">
              Only organization owners can modify settings.
            </p>
            <p className="text-yellow-700 text-sm mt-1">
              Contact your organization owner to change these settings.
            </p>
          </div>
        ) : (
          <ClockConfigForm organizationId={orgId} initialConfig={clockConfig} />
        )}
      </div>
    </div>
  );
}
