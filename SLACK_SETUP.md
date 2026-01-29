# Slack App Setup Guide

## 🎯 Overview

This app uses **two separate OAuth flows**:

1. **Sign-In Flow** (Better Auth) - For user authentication only
2. **Workspace Installation Flow** - For getting permissions to update statuses

---

## 📝 Required Scopes

### 🤖 Bot Token Scopes
Add under **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**:

```
emoji:read
```

### 👤 User Token Scopes
Add under **OAuth & Permissions** → **Scopes** → **User Token Scopes**:

```
openid
profile
email
users.profile:write
emoji:read
```

**Note:** The first three (`openid`, `profile`, `email`) are for "Sign in with Slack" (OpenID Connect). The last two are for workspace installation.

---

## 🔗 Redirect URLs

Add both URLs under **OAuth & Permissions** → **Redirect URLs**:

### Production
```
https://your-domain.com/api/slack/install/callback
https://your-domain.com/api/auth/callback/slack
```

### Development (localhost)
```
http://localhost:3000/api/slack/install/callback
http://localhost:3000/api/auth/callback/slack
```

---

## 🔄 Two OAuth Flows Explained

### Flow 1: User Sign-In (Better Auth)
**Endpoint:** `/api/auth/callback/slack`
**Scopes Used:** `openid`, `profile`, `email` (OpenID Connect)
**Purpose:** Authenticate users and create accounts
**When:** User clicks "Sign in with Slack"

**What happens:**
1. User authenticates with Slack
2. Basic profile info is fetched
3. User account created in database
4. User redirected to dashboard

**Note:** This does NOT give permission to update statuses yet!

---

### Flow 2: Workspace Installation
**Endpoint:** `/api/slack/install/callback`
**Bot Scopes:** `emoji:read`
**User Scopes:** `users.profile:write`, `emoji:read`
**Purpose:** Install app to workspace and get status update permissions
**When:** User/Admin clicks "Add to Slack"

**What happens:**
1. Admin authorizes workspace installation
2. Bot token stored (for fetching emojis)
3. User token stored (for updating that user's status)
4. Custom emojis cached
5. Organization and membership created in database

**Important:** Each user needs to go through this flow to get their status updated!

---

## ⚙️ Complete Setup Steps

### 1. Create Slack App
1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. Name: "Status Scheduler" (or your choice)
5. Pick your development workspace

### 2. Add Redirect URLs
1. Go to **OAuth & Permissions**
2. Scroll to **Redirect URLs**
3. Add all 4 URLs (2 for production, 2 for development)
4. Click "Save URLs"

### 3. Add Scopes
1. Still in **OAuth & Permissions**
2. Scroll to **Scopes**
3. Under **Bot Token Scopes**, add:
   - `emoji:read`
4. Under **User Token Scopes**, add:
   - `identity.basic`
   - `identity.email`
   - `users.profile:write`
   - `emoji:read`
5. Click "Save Changes"

### 4. Enable Token Rotation
1. Still in **OAuth & Permissions**
2. Scroll to **Token Rotation**
3. Toggle **Enable Token Rotation** ON
4. This ensures refresh tokens are provided

### 5. Get Your Credentials
1. Go to **Basic Information**
2. Scroll to **App Credentials**
3. Copy **Client ID** → Put in `.env` as `SLACK_CLIENT_ID`
4. Copy **Client Secret** → Put in `.env` as `SLACK_CLIENT_SECRET`

### 6. Customize App Appearance (Optional)
1. In **Basic Information**
2. Upload an app icon (calendar/clock)
3. Choose background color
4. Add short description

---

## ✅ Testing Checklist

### Test Sign-In
```
☐ Go to your app homepage
☐ Click "Sign in with Slack"
☐ Should redirect to Slack
☐ Authorize the app (only needs identity scopes)
☐ Should redirect back to /dashboard
☐ Verify user account created
```

### Test Workspace Installation
```
☐ In dashboard, click "Add to Slack" or "Add Workspace"
☐ Should redirect to Slack with more permission requests
☐ Authorize (will ask for profile:write and emoji:read)
☐ Should redirect back to dashboard
☐ Verify organization appears in workspace dropdown
☐ Verify you can create schedules
```

### Test Status Updates
```
☐ Create a schedule for current time
☐ Wait 5-10 minutes for cron job
☐ Check your Slack status - should be updated!
☐ Check Vercel cron logs for success message
```

---

## 🐛 Troubleshooting

### "Invalid scope requested" error
**Problem:** Wrong scopes in Better Auth config
**Solution:** Better Auth should use OpenID Connect scopes: `openid`, `profile`, `email` (NOT `identity.basic` or `identity.email`)

### "Add to Slack" button doesn't work
**Problem:** Wrong scopes in workspace installation
**Solution:** Should use `emoji:read` for bot, `users.profile:write,emoji:read` for user

### Redirect URL mismatch
**Problem:** Redirect URL not registered in Slack
**Solution:** Add both `/api/auth/callback/slack` and `/api/slack/install/callback`

### Status not updating
**Problem:** User hasn't installed app to workspace yet
**Solution:** Each user must click "Add to Slack" to grant permissions

### No custom emojis showing
**Problem:** Bot token doesn't have `emoji:read` scope
**Solution:** Verify bot scope is added and reinstall app

---

## 🔐 Security Notes

1. **Never commit credentials** - Keep `.env` in `.gitignore`
2. **Token rotation enabled** - Tokens refresh automatically before expiry
3. **Encrypted storage** - All tokens encrypted with AES-256-GCM
4. **Cron secret** - Protect cron endpoint with `CRON_SECRET`
5. **HTTPS only** - Always use HTTPS in production

---

## 📚 Reference Links

- [Slack OAuth Guide](https://api.slack.com/authentication/oauth-v2)
- [Slack Scopes Reference](https://api.slack.com/scopes)
- [Better Auth Docs](https://better-auth.com)
- [Token Rotation](https://api.slack.com/authentication/rotation)

---

## 🎉 You're Done!

Once setup is complete:
- Users sign in with their Slack account
- Admins install the app to their workspace
- Users create schedules
- Cron job updates statuses automatically every 5 minutes

Need help? Check the troubleshooting section above!
