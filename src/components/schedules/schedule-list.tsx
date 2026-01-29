"use client";

import { useState } from "react";
import { deleteSchedule, updateSchedule } from "@/actions/schedules";
import { utcToLocal, minutesToTimeString } from "@/lib/timezone-utils";
import type { Schedule } from "@/types";

interface ScheduleListProps {
  schedules: Schedule[];
  onEdit?: (schedule: Schedule) => void;
  onRefresh?: () => void;
}

export function ScheduleList({
  schedules,
  onEdit,
  onRefresh,
}: ScheduleListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleDelete = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) {
      return;
    }

    setDeletingId(scheduleId);
    try {
      await deleteSchedule(scheduleId);
      onRefresh?.();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete schedule");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (schedule: Schedule) => {
    setTogglingId(schedule.id);
    try {
      await updateSchedule({
        id: schedule.id,
        enabled: !schedule.enabled,
      });
      onRefresh?.();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update schedule");
    } finally {
      setTogglingId(null);
    }
  };

  const formatRecurrence = (recurring: string, recurringDays: any) => {
    switch (recurring) {
      case "none":
        return "No recurrence";
      case "daily":
        return "Daily";
      case "weekdays":
        return "Weekdays (Mon-Fri)";
      case "weekends":
        return "Weekends (Sat-Sun)";
      case "custom":
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const selectedDays = (recurringDays as number[])
          .sort()
          .map((d) => days[d])
          .join(", ");
        return `Custom: ${selectedDays}`;
      default:
        return recurring;
    }
  };

  const getScheduleStatus = (schedule: Schedule) => {
    const now = new Date();
    const startDate = new Date(schedule.startDate);
    const endDate = schedule.endDate ? new Date(schedule.endDate) : null;

    if (!schedule.enabled) {
      return { label: "Disabled", color: "bg-gray-100 text-gray-800" };
    }

    if (now < startDate) {
      return { label: "Upcoming", color: "bg-blue-100 text-blue-800" };
    }

    if (endDate && now > endDate) {
      return { label: "Ended", color: "bg-gray-100 text-gray-800" };
    }

    return { label: "Active", color: "bg-green-100 text-green-800" };
  };

  if (schedules.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600">No schedules yet. Create your first one!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => {
        const localStart = utcToLocal(
          new Date(schedule.startDate),
          schedule.timeStart,
          schedule.timezone
        );
        const localEnd = utcToLocal(
          new Date(schedule.startDate),
          schedule.timeEnd,
          schedule.timezone
        );
        const status = getScheduleStatus(schedule);

        return (
          <div
            key={schedule.id}
            className="border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg">{schedule.name}</h3>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${status.color}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Status:</span>
                    <span>{schedule.statusEmoji}</span>
                    <span>{schedule.statusText}</span>
                  </div>

                  <div>
                    <span className="font-medium">Time:</span>{" "}
                    {minutesToTimeString(localStart.minutes)} -{" "}
                    {minutesToTimeString(localEnd.minutes)} ({schedule.timezone})
                  </div>

                  <div>
                    <span className="font-medium">Dates:</span>{" "}
                    {new Date(schedule.startDate).toLocaleDateString()}
                    {schedule.endDate &&
                      ` - ${new Date(schedule.endDate).toLocaleDateString()}`}
                  </div>

                  <div>
                    <span className="font-medium">Recurrence:</span>{" "}
                    {formatRecurrence(schedule.recurring, schedule.recurringDays)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                {/* Toggle Switch */}
                <button
                  onClick={() => handleToggle(schedule)}
                  disabled={togglingId === schedule.id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    schedule.enabled ? "bg-blue-600" : "bg-gray-200"
                  } ${togglingId === schedule.id ? "opacity-50" : ""}`}
                  aria-label="Toggle schedule"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      schedule.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>

                {/* Edit Button */}
                <button
                  onClick={() => onEdit?.(schedule)}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
                >
                  Edit
                </button>

                {/* Delete Button */}
                <button
                  onClick={() => handleDelete(schedule.id)}
                  disabled={deletingId === schedule.id}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                >
                  {deletingId === schedule.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
