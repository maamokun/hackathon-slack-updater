"use client";

import { useEffect, useState } from "react";
import { getOrganizationEmojis } from "@/actions/emojis";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmojiPickerProps {
  organizationId: string;
  value: string;
  onChange: (emoji: string) => void;
  onClose?: () => void;
}

// Categorized standard emojis
const EMOJI_CATEGORIES = {
  recent: {
    label: "Recent",
    icon: "🕐",
    emojis: [] as Array<{ name: string; emoji: string }>,
  },
  smileys: {
    label: "Smileys",
    icon: "😀",
    emojis: [
      { name: "grinning", emoji: "😀" },
      { name: "smiley", emoji: "😃" },
      { name: "smile", emoji: "😄" },
      { name: "grin", emoji: "😁" },
      { name: "laughing", emoji: "😆" },
      { name: "sweat_smile", emoji: "😅" },
      { name: "joy", emoji: "😂" },
      { name: "rofl", emoji: "🤣" },
      { name: "relaxed", emoji: "☺️" },
      { name: "blush", emoji: "😊" },
      { name: "innocent", emoji: "😇" },
      { name: "wink", emoji: "😉" },
      { name: "relieved", emoji: "😌" },
      { name: "heart_eyes", emoji: "😍" },
      { name: "kissing_heart", emoji: "😘" },
      { name: "thinking", emoji: "🤔" },
      { name: "neutral_face", emoji: "😐" },
      { name: "expressionless", emoji: "😑" },
      { name: "confused", emoji: "😕" },
      { name: "worried", emoji: "😟" },
      { name: "tired_face", emoji: "😫" },
      { name: "sleeping", emoji: "😴" },
      { name: "sunglasses", emoji: "😎" },
      { name: "nerd", emoji: "🤓" },
    ],
  },
  activity: {
    label: "Activity",
    icon: "⚽",
    emojis: [
      { name: "soccer", emoji: "⚽" },
      { name: "basketball", emoji: "🏀" },
      { name: "football", emoji: "🏈" },
      { name: "tennis", emoji: "🎾" },
      { name: "volleyball", emoji: "🏐" },
      { name: "running", emoji: "🏃" },
      { name: "swimmer", emoji: "🏊" },
      { name: "bicyclist", emoji: "🚴" },
      { name: "weight_lifter", emoji: "🏋️" },
      { name: "muscle", emoji: "💪" },
      { name: "trophy", emoji: "🏆" },
      { name: "medal", emoji: "🏅" },
      { name: "1st_place", emoji: "🥇" },
      { name: "video_game", emoji: "🎮" },
      { name: "dart", emoji: "🎯" },
    ],
  },
  food: {
    label: "Food",
    icon: "🍕",
    emojis: [
      { name: "pizza", emoji: "🍕" },
      { name: "hamburger", emoji: "🍔" },
      { name: "fries", emoji: "🍟" },
      { name: "hotdog", emoji: "🌭" },
      { name: "taco", emoji: "🌮" },
      { name: "burrito", emoji: "🌯" },
      { name: "sushi", emoji: "🍣" },
      { name: "ramen", emoji: "🍜" },
      { name: "curry", emoji: "🍛" },
      { name: "coffee", emoji: "☕" },
      { name: "tea", emoji: "🍵" },
      { name: "beer", emoji: "🍺" },
      { name: "wine", emoji: "🍷" },
      { name: "cake", emoji: "🍰" },
      { name: "doughnut", emoji: "🍩" },
      { name: "cookie", emoji: "🍪" },
      { name: "apple", emoji: "🍎" },
      { name: "banana", emoji: "🍌" },
      { name: "watermelon", emoji: "🍉" },
      { name: "grapes", emoji: "🍇" },
    ],
  },
  travel: {
    label: "Travel",
    icon: "✈️",
    emojis: [
      { name: "airplane", emoji: "✈️" },
      { name: "car", emoji: "🚗" },
      { name: "taxi", emoji: "🚕" },
      { name: "bus", emoji: "🚌" },
      { name: "train", emoji: "🚆" },
      { name: "ship", emoji: "🚢" },
      { name: "rocket", emoji: "🚀" },
      { name: "bike", emoji: "🚲" },
      { name: "scooter", emoji: "🛴" },
      { name: "house", emoji: "🏠" },
      { name: "office", emoji: "🏢" },
      { name: "hotel", emoji: "🏨" },
      { name: "beach", emoji: "🏖️" },
      { name: "palm_tree", emoji: "🌴" },
      { name: "mountain", emoji: "⛰️" },
      { name: "camping", emoji: "🏕️" },
      { name: "world_map", emoji: "🗺️" },
      { name: "globe", emoji: "🌍" },
    ],
  },
  objects: {
    label: "Objects",
    icon: "💻",
    emojis: [
      { name: "computer", emoji: "💻" },
      { name: "keyboard", emoji: "⌨️" },
      { name: "phone", emoji: "📱" },
      { name: "telephone", emoji: "☎️" },
      { name: "camera", emoji: "📷" },
      { name: "video_camera", emoji: "📹" },
      { name: "tv", emoji: "📺" },
      { name: "watch", emoji: "⌚" },
      { name: "alarm_clock", emoji: "⏰" },
      { name: "hourglass", emoji: "⏳" },
      { name: "calendar", emoji: "📅" },
      { name: "clock", emoji: "🕐" },
      { name: "memo", emoji: "📝" },
      { name: "pencil", emoji: "✏️" },
      { name: "book", emoji: "📚" },
      { name: "bulb", emoji: "💡" },
      { name: "fire", emoji: "🔥" },
      { name: "star", emoji: "⭐" },
      { name: "sparkles", emoji: "✨" },
      { name: "tada", emoji: "🎉" },
      { name: "gift", emoji: "🎁" },
      { name: "balloon", emoji: "🎈" },
      { name: "musical_note", emoji: "🎵" },
      { name: "microphone", emoji: "🎤" },
      { name: "headphones", emoji: "🎧" },
    ],
  },
  symbols: {
    label: "Symbols",
    icon: "🔔",
    emojis: [
      { name: "bell", emoji: "🔔" },
      { name: "no_bell", emoji: "🔕" },
      { name: "loudspeaker", emoji: "📢" },
      { name: "mega", emoji: "📣" },
      { name: "speech_balloon", emoji: "💬" },
      { name: "thought_balloon", emoji: "💭" },
      { name: "zzz", emoji: "💤" },
      { name: "100", emoji: "💯" },
      { name: "white_check_mark", emoji: "✅" },
      { name: "x", emoji: "❌" },
      { name: "warning", emoji: "⚠️" },
      { name: "question", emoji: "❓" },
      { name: "exclamation", emoji: "❗" },
      { name: "heart", emoji: "❤️" },
      { name: "blue_heart", emoji: "💙" },
      { name: "green_heart", emoji: "💚" },
      { name: "yellow_heart", emoji: "💛" },
      { name: "purple_heart", emoji: "💜" },
      { name: "broken_heart", emoji: "💔" },
      { name: "thumbsup", emoji: "👍" },
      { name: "thumbsdown", emoji: "👎" },
      { name: "clap", emoji: "👏" },
      { name: "pray", emoji: "🙏" },
      { name: "raised_hands", emoji: "🙌" },
    ],
  },
};

export function EmojiPicker({
  organizationId,
  value,
  onChange,
  onClose,
}: EmojiPickerProps) {
  const [customEmojis, setCustomEmojis] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("smileys");

  useEffect(() => {
    loadCustomEmojis();
  }, [organizationId]);

  const loadCustomEmojis = async () => {
    try {
      const emojis = await getOrganizationEmojis(organizationId);
      setCustomEmojis(emojis);
    } catch (error) {
      console.error("Failed to load custom emojis:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (emojiName: string) => {
    onChange(`:${emojiName}:`);
    onClose?.();
  };

  // Filter emojis based on search
  const getFilteredEmojis = (category: keyof typeof EMOJI_CATEGORIES) => {
    const emojis = EMOJI_CATEGORIES[category].emojis;
    if (!searchQuery) return emojis;
    return emojis.filter((e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredCustomEmojis = Object.entries(customEmojis).filter(([name]) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get all matching emojis across categories for search
  const searchResults = searchQuery
    ? Object.entries(EMOJI_CATEGORIES)
        .flatMap(([key, cat]) =>
          cat.emojis.filter((e) =>
            e.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        )
    : [];

  return (
    <div className="w-96 bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <Input
          type="text"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
          autoFocus
        />
      </div>

      {/* Emoji Grid */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
        <TabsList variant="line" className="w-full justify-start px-3 border-b">
          {Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => (
            key !== "recent" && (
              <TabsTrigger key={key} value={key} className="text-xl">
                {cat.icon}
              </TabsTrigger>
            )
          ))}
          <TabsTrigger value="custom" className="text-xl">
            🎨
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="h-64">
          {searchQuery ? (
            // Show search results across all categories
            <div className="p-3">
              <div className="grid grid-cols-8 gap-1">
                {searchResults.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => handleSelect(item.name)}
                    className="p-2 text-2xl hover:bg-gray-100 rounded-md transition-colors"
                    title={item.name}
                  >
                    {item.emoji}
                  </button>
                ))}
                {filteredCustomEmojis.map(([name, url]) => (
                  <button
                    key={name}
                    onClick={() => handleSelect(name)}
                    className="p-2 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
                    title={name}
                  >
                    {url.startsWith("alias:") ? (
                      <span className="text-xs text-gray-500">
                        {url.replace("alias:", "")}
                      </span>
                    ) : (
                      <img
                        src={url}
                        alt={name}
                        className="w-6 h-6 object-contain"
                      />
                    )}
                  </button>
                ))}
              </div>
              {searchResults.length === 0 && filteredCustomEmojis.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No emojis found
                </div>
              )}
            </div>
          ) : (
            <>
              {Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => (
                key !== "recent" && (
                  <TabsContent key={key} value={key} className="p-3 mt-0">
                    <div className="text-xs font-semibold text-gray-500 mb-2">
                      {cat.label}
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {cat.emojis.map((item) => (
                        <button
                          key={item.name}
                          onClick={() => handleSelect(item.name)}
                          className="p-2 text-2xl hover:bg-gray-100 rounded-md transition-colors"
                          title={item.name}
                        >
                          {item.emoji}
                        </button>
                      ))}
                    </div>
                  </TabsContent>
                )
              ))}

              <TabsContent value="custom" className="p-3 mt-0">
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  Custom Emojis ({Object.keys(customEmojis).length})
                </div>
                {loading ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Loading custom emojis...
                  </div>
                ) : Object.keys(customEmojis).length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No custom emojis available
                  </div>
                ) : (
                  <div className="grid grid-cols-8 gap-1">
                    {Object.entries(customEmojis).map(([name, url]) => (
                      <button
                        key={name}
                        onClick={() => handleSelect(name)}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
                        title={name}
                      >
                        {url.startsWith("alias:") ? (
                          <span className="text-xs text-gray-500">
                            {url.replace("alias:", "")}
                          </span>
                        ) : (
                          <img
                            src={url}
                            alt={name}
                            className="w-6 h-6 object-contain"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </ScrollArea>
      </Tabs>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <p className="text-xs text-gray-600">
          Selected: <span className="font-mono font-semibold">{value || "None"}</span>
        </p>
      </div>
    </div>
  );
}
