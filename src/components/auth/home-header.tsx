"use client";

import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/auth/sign-in-button";
import Link from "next/link";

interface HomeHeaderProps {
  user?: {
    name: string;
  } | null;
}

export function HomeHeader({ user }: HomeHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      {user ? (
        <>
          <span className="text-sm text-gray-600">Welcome, {user.name}</span>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </>
      ) : (
        <SignInButton />
      )}
    </div>
  );
}
