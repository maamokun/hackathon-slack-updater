"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, History } from "lucide-react";
import { toggleUserClockStatus } from "@/actions/clock";
import { toast } from "sonner";
import { ClockHistoryModal } from "./clock-history-modal";

interface ClockStatusWidgetProps {
  initialStatus: {
    isClockedIn: boolean;
    lastClockIn: Date | null;
    lastClockOut: Date | null;
    lastUpdatedBy: string | null;
  };
}

export function ClockStatusWidget({ initialStatus }: ClockStatusWidgetProps) {
  const [isClockedIn, setIsClockedIn] = useState(initialStatus.isClockedIn);
  const [toggling, setToggling] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const result = await toggleUserClockStatus();
      setIsClockedIn(result.isClockedIn);
      toast.success(
        result.isClockedIn
          ? "You've clocked in! Your schedules are now active."
          : "You've clocked out! Your schedules are paused.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to toggle clock status",
      );
    } finally {
      setToggling(false);
    }
  };

  const lastChange = isClockedIn
    ? initialStatus.lastClockIn
    : initialStatus.lastClockOut;
  const timeAgo = lastChange ? getTimeAgo(new Date(lastChange)) : null;

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-gray-600">
                Clock Status
              </CardTitle>
              <CardDescription className="mt-1">
                {isClockedIn ? (
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    Clocked In
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-600">
                    <span className="h-2 w-2 rounded-full bg-gray-400" />
                    Clocked Out
                  </span>
                )}
              </CardDescription>
            </div>
            <Clock
              className={`h-5 w-5 ${isClockedIn ? "text-green-600" : "text-gray-400"}`}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {timeAgo && (
            <p className="text-xs text-gray-500">
              {isClockedIn ? "Clocked in" : "Clocked out"} {timeAgo}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleToggle}
              disabled={toggling}
              className="flex-1"
              variant={isClockedIn ? "outline" : "default"}
            >
              {toggling
                ? "Updating..."
                : isClockedIn
                  ? "Clock Out"
                  : "Clock In"}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowHistory(true)}
              title="View History"
            >
              <History className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {showHistory && (
        <ClockHistoryModal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
