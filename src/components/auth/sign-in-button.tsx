"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ButtonHTMLAttributes } from "react";

interface SignInButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function SignInButton({
  variant,
  size,
  children,
  ...props
}: SignInButtonProps) {
  const handleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: "slack",
        callbackURL: "/dashboard",
      });
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleSignIn} {...props}>
      {children || "Sign in with Slack"}
    </Button>
  );
}
