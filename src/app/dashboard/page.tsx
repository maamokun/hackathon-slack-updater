import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getUserOrganizations } from "@/actions/schedules";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  const organizations = await getUserOrganizations();

  // Fetch user's clock status
  const clockStatus = await prisma.clockStatus.findUnique({
    where: { userId: session.user.id },
  });

  // Default clock status if not found
  const initialClockStatus = clockStatus || {
    isClockedIn: false,
    lastClockIn: null,
    lastClockOut: null,
    lastUpdatedBy: null,
  };

  return (
    <DashboardClient
      user={session.user}
      organizations={organizations}
      clockStatus={initialClockStatus}
    />
  );
}
