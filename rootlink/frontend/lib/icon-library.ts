/**
 * Curated icon registry for the Content UI Editor's icon-swap feature
 * (discovery/mockups/content-ui-editor/briefing-to-build-local.md).
 *
 * Deliberately a fixed, curated set (not free-form SVG/upload) — icon overrides
 * store an `iconId` string that must resolve here, never raw markup. This keeps
 * the "only super_admin can touch this" surface free of an arbitrary-markup/XSS
 * risk, and keeps icon-swaps visually consistent with the rest of the platform
 * (which already standardizes on lucide-react everywhere — see
 * .opencode/skills/platform-coherence/references/architecture-overview.md).
 */
import {
  Leaf, Sprout, Flower, TreePine, Trees, Mountain, Bird, Sun, Cloud, CloudRain,
  Wind, Droplets, Bug,
  Users, Home, Heart, Handshake, Globe, Shield, Building,
  Wrench, Hammer, Scissors, Settings, Ruler, ShoppingBasket, Shovel,
  BookOpen, Lightbulb, GraduationCap, Search, MessageSquare, Share2, ScrollText,
  Calendar, Clock, CheckSquare, Bookmark, Bell, Star, Zap,
  type LucideIcon,
} from "lucide-react";

export type IconCategory = "plants" | "community" | "tools" | "nature" | "learning" | "time";

export interface IconLibraryEntry {
  id: string;
  label: string;
  category: IconCategory;
  Icon: LucideIcon;
}

export const ICON_LIBRARY: IconLibraryEntry[] = [
  // Plants
  { id: "leaf", label: "Leaf", category: "plants", Icon: Leaf },
  { id: "sprout", label: "Sprout", category: "plants", Icon: Sprout },
  { id: "flower", label: "Flower", category: "plants", Icon: Flower },
  { id: "tree-pine", label: "Tree", category: "plants", Icon: TreePine },
  { id: "trees", label: "Trees", category: "plants", Icon: Trees },
  { id: "bug", label: "Pollinator", category: "plants", Icon: Bug },

  // Community
  { id: "users", label: "Users", category: "community", Icon: Users },
  { id: "home", label: "Home", category: "community", Icon: Home },
  { id: "heart", label: "Heart", category: "community", Icon: Heart },
  { id: "handshake", label: "Handshake", category: "community", Icon: Handshake },
  { id: "globe", label: "Globe", category: "community", Icon: Globe },
  { id: "shield", label: "Shield", category: "community", Icon: Shield },
  { id: "building", label: "Building", category: "community", Icon: Building },

  // Tools
  { id: "wrench", label: "Wrench", category: "tools", Icon: Wrench },
  { id: "hammer", label: "Hammer", category: "tools", Icon: Hammer },
  { id: "scissors", label: "Scissors", category: "tools", Icon: Scissors },
  { id: "settings", label: "Settings", category: "tools", Icon: Settings },
  { id: "ruler", label: "Ruler", category: "tools", Icon: Ruler },
  { id: "basket", label: "Basket", category: "tools", Icon: ShoppingBasket },
  { id: "shovel", label: "Shovel", category: "tools", Icon: Shovel },

  // Nature
  { id: "mountain", label: "Mountain", category: "nature", Icon: Mountain },
  { id: "bird", label: "Bird", category: "nature", Icon: Bird },
  { id: "sun", label: "Sun", category: "nature", Icon: Sun },
  { id: "cloud", label: "Cloud", category: "nature", Icon: Cloud },
  { id: "rain", label: "Rain", category: "nature", Icon: CloudRain },
  { id: "wind", label: "Wind", category: "nature", Icon: Wind },
  { id: "droplet", label: "Droplet", category: "nature", Icon: Droplets },

  // Learning
  { id: "book", label: "Book", category: "learning", Icon: BookOpen },
  { id: "bulb", label: "Idea", category: "learning", Icon: Lightbulb },
  { id: "grad-cap", label: "Education", category: "learning", Icon: GraduationCap },
  { id: "search", label: "Search", category: "learning", Icon: Search },
  { id: "chat", label: "Message", category: "learning", Icon: MessageSquare },
  { id: "share", label: "Share", category: "learning", Icon: Share2 },
  { id: "scroll", label: "Document", category: "learning", Icon: ScrollText },

  // Time & action
  { id: "calendar", label: "Calendar", category: "time", Icon: Calendar },
  { id: "clock", label: "Clock", category: "time", Icon: Clock },
  { id: "check-sq", label: "Checklist", category: "time", Icon: CheckSquare },
  { id: "bookmark", label: "Bookmark", category: "time", Icon: Bookmark },
  { id: "bell", label: "Notification", category: "time", Icon: Bell },
  { id: "star", label: "Star", category: "time", Icon: Star },
  { id: "lightning", label: "Action", category: "time", Icon: Zap },
];

const ICON_BY_ID: Record<string, IconLibraryEntry> = Object.fromEntries(
  ICON_LIBRARY.map((entry) => [entry.id, entry])
);

export function getIconById(id: string | undefined | null): IconLibraryEntry | undefined {
  if (!id) return undefined;
  return ICON_BY_ID[id];
}

export const ICON_CATEGORIES: { value: IconCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "plants", label: "Plants" },
  { value: "community", label: "Community" },
  { value: "tools", label: "Tools" },
  { value: "nature", label: "Nature" },
  { value: "learning", label: "Learning" },
  { value: "time", label: "Time" },
];
