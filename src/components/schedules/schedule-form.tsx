"use client";

import { useState, useEffect, useRef } from "react";
import { createSchedule, updateSchedule } from "@/actions/schedules";
import { refreshOrganizationEmojis } from "@/actions/emojis";
import {
  getUserTimezone,
  localToUTC,
  utcToLocal,
  minutesToTimeString,
  timeStringToMinutes,
  COMMON_TIMEZONES,
} from "@/lib/timezone-utils";
import type { Schedule } from "@/types";
import { EmojiPicker } from "./emoji-picker";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

interface ScheduleFormProps {
  organizationId: string;
  schedule?: Schedule;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ScheduleForm({
  organizationId,
  schedule,
  onSuccess,
  onCancel,
}: ScheduleFormProps) {
  const userTimezone = getUserTimezone();
  const isEditing = !!schedule;

  // Convert UTC times to local for editing
  const initialLocalTimes = schedule
    ? utcToLocal(new Date(schedule.startDate), schedule.timeStart, schedule.timezone)
    : null;
  const initialEndLocalTimes = schedule?.endDate
    ? utcToLocal(new Date(schedule.endDate), schedule.timeEnd, schedule.timezone)
    : null;

  const [formData, setFormData] = useState({
    name: schedule?.name || "",
    startDate: initialLocalTimes?.date.toISOString().split("T")[0] || "",
    endDate: initialEndLocalTimes?.date.toISOString().split("T")[0] || "",
    timeStart: minutesToTimeString(initialLocalTimes?.minutes || 540), // 9:00 AM default
    timeEnd: minutesToTimeString(initialEndLocalTimes?.minutes || 1020), // 5:00 PM default
    timezone: schedule?.timezone || userTimezone,
    statusText: schedule?.statusText || "",
    statusEmoji: schedule?.statusEmoji || ":calendar:",
    recurring: schedule?.recurring || "none",
    recurringDays: (schedule?.recurringDays as number[]) || [],
    requiresClockedIn: schedule?.requiresClockedIn || false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [refreshingEmojis, setRefreshingEmojis] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEmojiPicker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Convert local times to UTC
      const startDateObj = new Date(formData.startDate);
      const timeStartMinutes = timeStringToMinutes(formData.timeStart);
      const timeEndMinutes = timeStringToMinutes(formData.timeEnd);

      const utcStart = localToUTC(startDateObj, timeStartMinutes, formData.timezone);

      const endDateObj = formData.endDate ? new Date(formData.endDate) : undefined;
      const utcEnd = endDateObj
        ? localToUTC(endDateObj, timeEndMinutes, formData.timezone)
        : undefined;

      const data = {
        organizationId,
        name: formData.name,
        startDate: utcStart.date,
        endDate: utcEnd?.date,
        timeStart: utcStart.minutes,
        timeEnd: utcEnd ? utcEnd.minutes : localToUTC(startDateObj, timeEndMinutes, formData.timezone).minutes,
        timezone: formData.timezone,
        statusText: formData.statusText,
        statusEmoji: formData.statusEmoji,
        recurring: formData.recurring as "none" | "daily" | "weekdays" | "weekends" | "custom",
        recurringDays: formData.recurring === "custom" ? formData.recurringDays : undefined,
        requiresClockedIn: formData.requiresClockedIn,
      };

      if (isEditing) {
        await updateSchedule({ id: schedule.id, ...data });
      } else {
        await createSchedule(data);
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter((d) => d !== day)
        : [...prev.recurringDays, day],
    }));
  };

  const handleRefreshEmojis = async () => {
    setRefreshingEmojis(true);
    try {
      const result = await refreshOrganizationEmojis(organizationId);
      toast.success(`Successfully refreshed ${result.count} custom emojis!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh emojis");
    } finally {
      setRefreshingEmojis(false);
    }
  };

  const weekDays = [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Schedule Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Schedule Name
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="e.g., Work Hours, Lunch Break"
        />
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            required
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium">
            End Date (Optional)
          </label>
          <input
            type="date"
            id="endDate"
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
            min={formData.startDate}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      {/* Time Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="timeStart" className="block text-sm font-medium">
            Start Time
          </label>
          <input
            type="time"
            id="timeStart"
            required
            value={formData.timeStart}
            onChange={(e) =>
              setFormData({ ...formData, timeStart: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="timeEnd" className="block text-sm font-medium">
            End Time
          </label>
          <input
            type="time"
            id="timeEnd"
            required
            value={formData.timeEnd}
            onChange={(e) =>
              setFormData({ ...formData, timeEnd: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label htmlFor="timezone" className="block text-sm font-medium">
          Timezone
        </label>
        <select
          id="timezone"
          value={formData.timezone}
          onChange={(e) =>
            setFormData({ ...formData, timezone: e.target.value })
          }
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      {/* Status Text */}
      <div>
        <label htmlFor="statusText" className="block text-sm font-medium">
          Status Text
        </label>
        <input
          type="text"
          id="statusText"
          required
          value={formData.statusText}
          onChange={(e) =>
            setFormData({ ...formData, statusText: e.target.value })
          }
          maxLength={100}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="e.g., In a meeting, On lunch break"
        />
      </div>

      {/* Refresh Emojis Button */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefreshEmojis}
          disabled={refreshingEmojis}
        >
          <RefreshCwIcon className={`mr-2 h-3 w-3 ${refreshingEmojis ? 'animate-spin' : ''}`} />
          {refreshingEmojis ? "Refreshing..." : "Refresh Custom Emojis"}
        </Button>
      </div>

      {/* Status Emoji */}
      <div>
        <label htmlFor="statusEmoji" className="block text-sm font-medium">
          Status Emoji
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="mt-1 w-full flex items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-left hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <span className="flex items-center gap-2">
              {formData.statusEmoji && (
                <span className="text-xl">{formData.statusEmoji.replace(/:/g, '')}</span>
              )}
              <span className={formData.statusEmoji ? "text-gray-700" : "text-gray-400"}>
                {formData.statusEmoji || "Select an emoji"}
              </span>
            </span>
            <svg
              className="h-5 w-5 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute z-50 mt-2">
              <EmojiPicker
                organizationId={organizationId}
                value={formData.statusEmoji}
                onChange={(emoji) => {
                  setFormData({ ...formData, statusEmoji: emoji });
                  setShowEmojiPicker(false);
                }}
                onClose={() => setShowEmojiPicker(false)}
              />
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Click to browse emojis or type manually (e.g., :calendar:, :pizza:)
        </p>
      </div>

      {/* Recurrence */}
      <div>
        <label className="block text-sm font-medium">Recurrence</label>
        <select
          value={formData.recurring}
          onChange={(e) =>
            setFormData({ ...formData, recurring: e.target.value })
          }
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="none">No Recurrence</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays (Mon-Fri)</option>
          <option value="weekends">Weekends (Sat-Sun)</option>
          <option value="custom">Custom Days</option>
        </select>
      </div>

      {/* Custom Days Selection */}
      {formData.recurring === "custom" && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Select Days
          </label>
          <div className="flex gap-2">
            {weekDays.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => handleDayToggle(day.value)}
                className={`px-3 py-2 rounded-md border text-sm font-medium ${
                  formData.recurringDays.includes(day.value)
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clock-in Requirement */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="requiresClockedIn"
          checked={formData.requiresClockedIn}
          onChange={(e) =>
            setFormData({ ...formData, requiresClockedIn: e.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <label htmlFor="requiresClockedIn" className="text-sm font-medium cursor-pointer">
            Only activate when clocked in
          </label>
          <p className="text-xs text-gray-500 mt-1">
            This schedule will only update your status when you're clocked in. Use clock-in keywords in your organization's monitored channel or use the /clockin slash command.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : isEditing ? "Update Schedule" : "Create Schedule"}
        </button>
      </div>
    </form>
  );
}
