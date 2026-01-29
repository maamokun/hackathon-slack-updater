"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOrganizationChannels, updateClockConfig } from "@/actions/clock";
import { toast } from "sonner";
import { EmojiPicker } from "../schedules/emoji-picker";

interface ClockConfig {
  id: string;
  channelId: string;
  channelName: string;
  clockInKeywords: string[];
  clockInEmoji: string;
  clockOutKeywords: string[];
  clockOutEmoji: string;
  enabled: boolean;
}

interface ClockConfigFormProps {
  organizationId: string;
  initialConfig: ClockConfig | null;
}

export function ClockConfigForm({
  organizationId,
  initialConfig,
}: ClockConfigFormProps) {
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    channelId: initialConfig?.channelId || "",
    channelName: initialConfig?.channelName || "",
    clockInKeywords:
      initialConfig?.clockInKeywords.join(", ") ||
      "gm, good morning, clocking in",
    clockInEmoji: initialConfig?.clockInEmoji || ":wave:",
    clockOutKeywords:
      initialConfig?.clockOutKeywords.join(", ") ||
      "gn, good night, clocking out",
    clockOutEmoji: initialConfig?.clockOutEmoji || ":zzz:",
    enabled: initialConfig?.enabled ?? true,
  });

  const [showClockInEmojiPicker, setShowClockInEmojiPicker] = useState(false);
  const [showClockOutEmojiPicker, setShowClockOutEmojiPicker] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const channelList = await getOrganizationChannels(organizationId);
      setChannels(channelList);
    } catch (error) {
      toast.error("Failed to load channels");
      console.error(error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Parse keywords (trim and filter empty)
      const clockInKeywords = formData.clockInKeywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const clockOutKeywords = formData.clockOutKeywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      if (clockInKeywords.length === 0) {
        toast.error("At least one clock-in keyword is required");
        setSaving(false);
        return;
      }

      if (clockOutKeywords.length === 0) {
        toast.error("At least one clock-out keyword is required");
        setSaving(false);
        return;
      }

      if (!formData.channelId) {
        toast.error("Please select a channel to monitor");
        setSaving(false);
        return;
      }

      await updateClockConfig({
        organizationId,
        channelId: formData.channelId,
        channelName: formData.channelName,
        clockInKeywords,
        clockInEmoji: formData.clockInEmoji,
        clockOutKeywords,
        clockOutEmoji: formData.clockOutEmoji,
        enabled: formData.enabled,
      });

      toast.success("Clock configuration saved successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save configuration",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChannelChange = (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    if (channel) {
      setFormData({
        ...formData,
        channelId: channel.id,
        channelName: channel.name,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clock-In/Clock-Out Configuration</CardTitle>
          <CardDescription>
            Configure automatic clock tracking based on channel messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Enable Clock Tracking</p>
              <p className="text-sm text-gray-600">
                Monitor messages in the selected channel for clock keywords
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={formData.enabled}
                onChange={(e) =>
                  setFormData({ ...formData, enabled: e.target.checked })
                }
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Channel Selection */}
          <div>
            <label htmlFor="channel" className="block text-sm font-medium mb-2">
              Channel to Monitor
            </label>
            <Select
              value={formData.channelId}
              onValueChange={handleChannelChange}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingChannels ? "Loading channels..." : "Select a channel"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              The bot will monitor this channel for clock-in/out keywords
            </p>
          </div>

          {/* Clock-In Keywords */}
          <div>
            <label
              htmlFor="clockInKeywords"
              className="block text-sm font-medium mb-2"
            >
              Clock-In Keywords
            </label>
            <input
              type="text"
              id="clockInKeywords"
              value={formData.clockInKeywords}
              onChange={(e) =>
                setFormData({ ...formData, clockInKeywords: e.target.value })
              }
              className="block w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="gm, good morning, clocking in"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated list. Matching is case-insensitive and partial.
            </p>
          </div>

          {/* Clock-In Emoji */}
          <div>
            <label
              htmlFor="clockInEmoji"
              className="block text-sm font-medium mb-2"
            >
              Clock-In Reaction Emoji
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setShowClockInEmojiPicker(!showClockInEmojiPicker)
                }
                className="w-full flex items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-left hover:border-gray-400"
              >
                <span className="flex items-center gap-2">
                  <span className="text-xl">
                    {formData.clockInEmoji.replace(/:/g, "")}
                  </span>
                  <span>{formData.clockInEmoji}</span>
                </span>
              </button>
              {showClockInEmojiPicker && (
                <div className="absolute z-50 mt-2">
                  <EmojiPicker
                    organizationId={organizationId}
                    value={formData.clockInEmoji}
                    onChange={(emoji) => {
                      setFormData({ ...formData, clockInEmoji: emoji });
                      setShowClockInEmojiPicker(false);
                    }}
                    onClose={() => setShowClockInEmojiPicker(false)}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The bot will react with this emoji when someone clocks in
            </p>
          </div>

          {/* Clock-Out Keywords */}
          <div>
            <label
              htmlFor="clockOutKeywords"
              className="block text-sm font-medium mb-2"
            >
              Clock-Out Keywords
            </label>
            <input
              type="text"
              id="clockOutKeywords"
              value={formData.clockOutKeywords}
              onChange={(e) =>
                setFormData({ ...formData, clockOutKeywords: e.target.value })
              }
              className="block w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="gn, good night, clocking out"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated list. Matching is case-insensitive and partial.
            </p>
          </div>

          {/* Clock-Out Emoji */}
          <div>
            <label
              htmlFor="clockOutEmoji"
              className="block text-sm font-medium mb-2"
            >
              Clock-Out Reaction Emoji
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setShowClockOutEmojiPicker(!showClockOutEmojiPicker)
                }
                className="w-full flex items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-left hover:border-gray-400"
              >
                <span className="flex items-center gap-2">
                  <span className="text-xl">
                    {formData.clockOutEmoji.replace(/:/g, "")}
                  </span>
                  <span>{formData.clockOutEmoji}</span>
                </span>
              </button>
              {showClockOutEmojiPicker && (
                <div className="absolute z-50 mt-2">
                  <EmojiPicker
                    organizationId={organizationId}
                    value={formData.clockOutEmoji}
                    onChange={(emoji) => {
                      setFormData({ ...formData, clockOutEmoji: emoji });
                      setShowClockOutEmojiPicker(false);
                    }}
                    onClose={() => setShowClockOutEmojiPicker(false)}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The bot will react with this emoji when someone clocks out
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </form>
  );
}
