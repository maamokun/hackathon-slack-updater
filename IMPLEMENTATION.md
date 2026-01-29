# Slack Status Scheduler - Implementation Guide

## Overview

A Next.js application that automatically updates users' Slack statuses based on customizable schedules. Built with Better Auth, Prisma, and Vercel Cron.

## Architecture

### Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Authentication:** Better Auth with Slack OAuth
- **Database:** PostgreSQL with Prisma ORM
- **UI:** Shadcn UI + Tailwind CSS
- **Cron Jobs:** Vercel Cron (runs every 5 minutes)
- **Package Manager:** Bun

### Key Features
- 🔐 Secure token encryption (AES-256-GCM)
- 🔄 Automatic token refresh (1 hour before expiration)
- 🌍 Timezone-aware scheduling (UTC storage, local display)
- 📅 Flexible recurrence patterns (daily, weekdays, weekends, custom)
- 🎨 Custom workspace emoji support
- ⚡ Server Actions with access control

## Project Structure

```
src/
├── actions/
│   ├── schedules.ts          # Server actions for schedule CRUD
│   └── emojis.ts              # Server action for fetching emojis
├── app/
│   ├── api/
│   │   ├── auth/[...all]/     # Better Auth routes
│   │   ├── slack/install/     # Workspace installation OAuth
│   │   └── cron/              # Vercel Cron endpoints
│   ├── dashboard/             # User dashboard
│   ├── page.tsx               # Landing page
│   └── layout.tsx             # Root layout
├── components/
│   ├── auth/                  # Auth components (SignInButton)
│   ├── dashboard/             # Dashboard client component
│   ├── schedules/             # Schedule form, list, emoji picker
│   └── ui/                    # Shadcn UI components
├── lib/
│   ├── auth.ts                # Better Auth server config
│   ├── auth-client.ts         # Better Auth client config
│   ├── db.ts                  # Prisma client instance
│   ├── env.ts                 # Environment validation (t3-env)
│   ├── crypto.ts              # Token encryption/decryption
│   ├── slack-tokens.ts        # Token refresh logic
│   ├── slack-api.ts           # Slack API integration
│   └── timezone-utils.ts      # Timezone conversion utilities
└── types/
    └── index.ts               # Prisma type re-exports

prisma/
├── schema.prisma              # Database schema
└── migrations/                # Migration files
```

## Database Schema

### Core Models

**User** - Base user from Better Auth
- Linked to organizations via `OrganizationMember`
- Owns schedules

**Organization** - Slack workspace
- `slackTeamId`: Unique workspace ID
- `botAccessToken/botRefreshToken`: Encrypted bot tokens
- `customEmojis`: Cached custom emoji JSON

**OrganizationMember** - User-workspace relationship
- `slackUserId`: Slack user ID
- `userAccessToken/userRefreshToken`: Encrypted user tokens
- `role`: "owner" or "member"

**Schedule** - Status schedule
- Date range: `startDate`, `endDate` (UTC)
- Time range: `timeStart`, `timeEnd` (minutes from midnight in UTC)
- `timezone`: IANA timezone for display
- `statusText`, `statusEmoji`: Status configuration
- `recurring`: "none" | "daily" | "weekdays" | "weekends" | "custom"
- `recurringDays`: Array of days (0=Sunday, 6=Saturday)

## Authentication Flow

### User Sign-In
1. User clicks "Sign in with Slack"
2. `SignInButton` calls `authClient.signIn.social({ provider: "slack" })`
3. Better Auth redirects to Slack OAuth
4. Slack redirects back to `/api/auth/callback/slack`
5. Better Auth creates session and user record
6. User redirected to `/dashboard`

### Workspace Installation
1. Admin clicks "Add to Slack"
2. Redirects to `/api/slack/install`
3. OAuth with bot + user scopes
4. Callback to `/api/slack/install/callback`
5. Stores encrypted tokens in `Organization` and `OrganizationMember`
6. Fetches and caches custom emojis
7. Redirects to dashboard

## Security

### Token Encryption
- **Algorithm:** AES-256-GCM
- **Key:** 64-character hex string (`TOKEN_ENCRYPTION_KEY`)
- **Format:** `iv:authTag:encryptedData` (hex encoded)
- Tokens decrypted only when needed for API calls

### Token Refresh
- Checks expiration 1 hour before expiry
- Automatically refreshes via `oauth.v2.access`
- Updates encrypted tokens in database
- Happens transparently in `ensureFreshOrgToken()` and `ensureFreshMemberToken()`

### Access Control
Every server action:
1. Validates session with `auth.api.getSession()`
2. Verifies organization membership
3. Checks permissions (owner-only for admin actions)

## Timezone Handling

### Storage
- All dates stored in UTC
- Times stored as minutes from midnight (0-1439) in UTC

### Display
- User selects their timezone
- `utcToLocal()` converts for display
- `localToUTC()` converts before saving

### Cron Job Logic
1. Get current UTC time
2. Query schedules with UTC date/time ranges
3. Check if current day matches recurrence pattern
4. Update user statuses

## Scheduled Status Updates

### Vercel Cron Configuration
```json
{
  "crons": [{
    "path": "/api/cron/update-statuses",
    "schedule": "*/5 * * * *"
  }]
}
```

### Update Logic (`/api/cron/update-statuses`)
1. Verify `CRON_SECRET` header
2. Get current UTC time and day
3. Query enabled schedules in date range
4. Filter by time range and recurrence
5. Group by user (highest priority wins)
6. Refresh tokens if needed
7. Call Slack `users.profile.set` API
8. Log results

## Environment Variables

```env
# Database
DATABASE_URL=postgres://...

# Slack OAuth
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...

# Security
CRON_SECRET=<random-secret>
TOKEN_ENCRYPTION_KEY=<64-char-hex>

# App
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## Setup Instructions

### 1. Install Dependencies
```bash
bun install
```

### 2. Configure Environment
Copy `.env` and fill in all variables. Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set Up Database
```bash
# Generate Prisma client
bunx prisma generate

# Run migrations (when DB is accessible)
bun prisma migrate dev
```

### 4. Configure Slack App
Go to api.slack.com/apps and create an app:

**OAuth & Permissions:**
- Redirect URLs:
  - `https://your-domain.com/api/slack/install/callback`
  - `https://your-domain.com/api/auth/callback/slack`
- Bot Token Scopes:
  - `emoji:read` (for workspace custom emojis)
- User Token Scopes:
  - `openid` (OpenID Connect sign-in)
  - `profile` (OpenID Connect sign-in)
  - `email` (OpenID Connect sign-in)
  - `users.profile:write` (update user's status)
  - `emoji:read` (read emojis as user)

**Enable Token Rotation** for security

### 5. Run Development Server
```bash
bun dev
```

### 6. Deploy to Vercel
```bash
vercel
```

Set all environment variables in Vercel dashboard.

## API Routes

### Authentication
- `POST /api/auth/sign-in/social` - Slack OAuth sign-in
- `GET /api/auth/callback/slack` - OAuth callback

### Workspace Installation
- `GET /api/slack/install` - Initiates workspace OAuth
- `GET /api/slack/install/callback` - Handles installation callback

### Cron Jobs
- `GET /api/cron/update-statuses` - Updates user statuses (Vercel Cron only)

## Server Actions

### Schedule Management
- `createSchedule(data)` - Create new schedule
- `updateSchedule(id, data)` - Update existing schedule
- `deleteSchedule(id)` - Delete schedule
- `getSchedules(orgId)` - List user's schedules
- `getUserOrganizations()` - Get user's workspaces

### Organization Management
- `getOrganizationMembers(orgId)` - List members (owner only)
- `removeOrganizationMember(memberId)` - Remove member (owner only)

### Emoji Management
- `getOrganizationEmojis(orgId)` - Fetch custom emojis (cached)

## Components

### Client Components
- `SignInButton` - Triggers Slack OAuth
- `HomeHeader` - Header with auth state
- `DashboardClient` - Main dashboard with org selector
- `ScheduleForm` - Create/edit schedule form with timezone picker
- `ScheduleList` - Display and manage schedules
- `EmojiPicker` - Select standard or custom emojis

### Server Components
- `Home` - Landing page with auth check
- `DashboardPage` - Fetches organizations server-side

## Testing

### Manual Testing Checklist
1. ✅ Sign in with Slack
2. ✅ Install app to workspace
3. ✅ Create schedule with timezone
4. ✅ Edit schedule
5. ✅ Toggle schedule enable/disable
6. ✅ Delete schedule
7. ✅ Test emoji picker (standard + custom)
8. ✅ Verify cron job runs (check logs)
9. ✅ Confirm status updates in Slack

## Deployment Checklist

- [ ] Set all environment variables in Vercel
- [ ] Run database migrations
- [ ] Configure Slack app redirect URLs
- [ ] Enable Vercel Cron
- [ ] Test workspace installation flow
- [ ] Verify status updates run correctly
- [ ] Monitor error logs

## Troubleshooting

### Token Errors
- Check `TOKEN_ENCRYPTION_KEY` is 64 characters
- Verify tokens are being refreshed (check logs)
- Ensure Slack app has correct scopes

### Cron Not Running
- Verify `CRON_SECRET` matches
- Check Vercel Cron logs
- Ensure endpoint returns 200 status

### Status Not Updating
- Check schedule time ranges (UTC vs local)
- Verify user tokens are valid
- Check recurring days configuration
- Review cron job logs for errors

## Future Enhancements

- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Status templates library
- [ ] Bulk schedule operations
- [ ] Analytics dashboard
- [ ] Webhook support for real-time updates
- [ ] Mobile app
- [ ] Team-wide schedule templates

## License

Private project - All rights reserved
