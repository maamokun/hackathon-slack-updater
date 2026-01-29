-- AlterTable
ALTER TABLE "schedule" ADD COLUMN     "requiresClockedIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "clock_config" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "clockInKeywords" JSONB NOT NULL,
    "clockInEmoji" TEXT NOT NULL,
    "clockOutKeywords" JSONB NOT NULL,
    "clockOutEmoji" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clock_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clock_status" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isClockedIn" BOOLEAN NOT NULL DEFAULT false,
    "lastClockIn" TIMESTAMP(3),
    "lastClockOut" TIMESTAMP(3),
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clock_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clock_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageTs" TEXT,
    "channelId" TEXT,

    CONSTRAINT "clock_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_opt_out" (
    "id" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dm_opt_out_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clock_config_organizationId_key" ON "clock_config"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "clock_status_userId_key" ON "clock_status"("userId");

-- CreateIndex
CREATE INDEX "clock_event_userId_idx" ON "clock_event"("userId");

-- CreateIndex
CREATE INDEX "clock_event_timestamp_idx" ON "clock_event"("timestamp");

-- CreateIndex
CREATE INDEX "dm_opt_out_slackUserId_idx" ON "dm_opt_out"("slackUserId");

-- CreateIndex
CREATE UNIQUE INDEX "dm_opt_out_slackUserId_organizationId_key" ON "dm_opt_out"("slackUserId", "organizationId");

-- AddForeignKey
ALTER TABLE "clock_config" ADD CONSTRAINT "clock_config_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clock_status" ADD CONSTRAINT "clock_status_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clock_event" ADD CONSTRAINT "clock_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
