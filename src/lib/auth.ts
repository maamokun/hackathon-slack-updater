import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    socialProviders: {
        slack: {
            clientId: env.SLACK_CLIENT_ID,
            clientSecret: env.SLACK_CLIENT_SECRET,
            // OpenID Connect scopes for sign-in only
            // Full scopes are requested during workspace installation
            scope: ["openid", "profile", "email"],
        }
    }
});