import { verify } from "jsonwebtoken";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth/sign-in-button";

interface JoinPageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function JoinPage({
  params,
  searchParams,
}: JoinPageProps) {
  const { orgId } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Invalid Invite Link
          </h1>
          <p className="text-gray-600">
            This invite link is missing required information. Please request a
            new invite.
          </p>
        </div>
      </div>
    );
  }

  // Verify JWT token
  let decoded: any;
  try {
    decoded = verify(token, env.TOKEN_ENCRYPTION_KEY);
  } catch (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Expired or Invalid Link
          </h1>
          <p className="text-gray-600">
            This invite link has expired or is invalid. Please request a new
            invite.
          </p>
        </div>
      </div>
    );
  }

  if (decoded.organizationId !== orgId || decoded.type !== "join_invite") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Invalid Invite
          </h1>
          <p className="text-gray-600">
            This invite link is not valid. Please request a new invite.
          </p>
        </div>
      </div>
    );
  }

  // Get organization info
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      slackTeamName: true,
      slackTeamId: true,
    },
  });

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Organization Not Found
          </h1>
          <p className="text-gray-600">
            This organization no longer exists or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 flex items-center justify-center bg-blue-100 rounded-full mb-4">
            <svg
              className="h-6 w-6 text-blue-600"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Join Status Scheduler
          </h1>
          <p className="text-gray-600">
            You've been invited to use Status Scheduler for
          </p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {org.slackTeamName}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-900 mb-2">
            What is Status Scheduler?
          </h2>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Automatically update your Slack status based on schedules</li>
            <li>• Clock in/out with simple keywords in Slack</li>
            <li>• Manage your status from a web dashboard</li>
            <li>• Sync with your work hours and breaks</li>
          </ul>
        </div>

        <div className="space-y-3">
          <SignInButton className="w-full" />

          <p className="text-xs text-center text-gray-500">
            By signing in, you'll connect your Slack account and gain access to
            Status Scheduler for {org.slackTeamName}.
          </p>
        </div>
      </div>
    </div>
  );
}
