"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUserClockHistory } from "@/actions/clock";
import { Clock, MessageSquare, Hand, Terminal } from "lucide-react";

interface ClockEvent {
  id: string;
  action: string;
  method: string;
  timestamp: Date;
  messageTs: string | null;
  channelId: string | null;
}

interface ClockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClockHistoryModal({ isOpen, onClose }: ClockHistoryModalProps) {
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const history = await getUserClockHistory(50);
      setEvents(history);
    } catch (error) {
      console.error("Failed to load clock history:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Clock History</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading history...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No clock history yet</p>
              <p className="text-sm mt-1">
                Your clock-in and clock-out events will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <div className="mt-0.5">
                    {getMethodIcon(event.method)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        event.action === "clock_in"
                          ? "text-green-700"
                          : "text-gray-700"
                      }`}>
                        {event.action === "clock_in" ? "Clocked In" : "Clocked Out"}
                      </span>
                      <span className="text-xs text-gray-500">
                        via {getMethodLabel(event.method)}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 mt-1">
                      {formatTimestamp(new Date(event.timestamp))}
                    </div>
                  </div>

                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    event.action === "clock_in"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    {event.action === "clock_in" ? "In" : "Out"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getMethodIcon(method: string) {
  const iconClass = "h-5 w-5 text-gray-600";

  switch (method) {
    case "message":
      return <MessageSquare className={iconClass} />;
    case "manual":
      return <Hand className={iconClass} />;
    case "slash_command":
      return <Terminal className={iconClass} />;
    default:
      return <Clock className={iconClass} />;
  }
}

function getMethodLabel(method: string): string {
  switch (method) {
    case "message":
      return "Channel Message";
    case "manual":
      return "Manual Toggle";
    case "slash_command":
      return "Slash Command";
    default:
      return method;
  }
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  // If less than 1 minute ago
  if (seconds < 60) {
    return "Just now";
  }

  // If less than 1 hour ago
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  // If less than 24 hours ago
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  // If today
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  // If yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  // Otherwise show full date
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
