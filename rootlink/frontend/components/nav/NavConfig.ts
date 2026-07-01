import {
  Search,
  Users,
  CalendarDays,
  RefreshCw,
  Sprout,
  BookOpen,
  Building2,
  Network,
  Leaf,
  Wrench,
  ShoppingBag,
  Home,
  Bell,
  User,
  FileText,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  labelKey: string;
  descriptionKey?: string;
  icon: LucideIcon;
  authRequired?: boolean;
  staffOnly?: boolean;
}

export interface NavGroup {
  labelKey: string;
  eyebrowKey: string;
  items: NavItem[];
}

export const discoverGroup: NavGroup = {
  labelKey: "nav.discover",
  eyebrowKey: "nav.discover",
  items: [
    { href: "/search",   labelKey: "nav.search",   descriptionKey: "nav.search_desc",   icon: Search },
    { href: "/groups",   labelKey: "nav.groups",   descriptionKey: "nav.groups_desc",   icon: Users },
    { href: "/events",   labelKey: "nav.events",   descriptionKey: "nav.events_desc",   icon: CalendarDays },
    { href: "/network",  labelKey: "nav.network",  descriptionKey: "nav.network_desc",  icon: Network },
    { href: "/entities", labelKey: "nav.entities", descriptionKey: "nav.entities_desc", icon: Building2 },
    { href: "/feed",     labelKey: "nav.feed",     descriptionKey: "nav.feed_desc",     icon: RefreshCw },
  ],
};

export const growGroup: NavGroup = {
  labelKey: "nav.grow",
  eyebrowKey: "nav.grow",
  items: [
    { href: "/plants",   labelKey: "nav.plants",   descriptionKey: "nav.plants_desc",   icon: Leaf },
    { href: "/learning", labelKey: "nav.learning", descriptionKey: "nav.learning_desc", icon: BookOpen },
    { href: "/tools",    labelKey: "nav.tools",    descriptionKey: "nav.tools_desc",    icon: Wrench },
  ],
};

export const exchangeGroup: NavGroup = {
  labelKey: "nav.exchange",
  eyebrowKey: "nav.exchange",
  items: [
    { href: "/marketplace", labelKey: "nav.marketplace", descriptionKey: "nav.marketplace_desc", icon: ShoppingBag },
    { href: "/composting",  labelKey: "nav.composting",  descriptionKey: "nav.composting_desc",  icon: Sprout },
    { href: "/upcycling",   labelKey: "nav.upcycling",   descriptionKey: "nav.upcycling_desc",   icon: RefreshCw },
  ],
};

export const desktopDropdowns: NavGroup[] = [discoverGroup, growGroup, exchangeGroup];

/** Mobile bottom tabs — used by MobileBottomBar */
export const mobileBottomTabs = [
  { href: "/",         labelKey: "nav.home",    icon: Home,     type: "link"    as const },
  { href: "/learning", labelKey: "nav.learning", icon: BookOpen, type: "link"   as const },
  {                    labelKey: "create.button", icon: ShoppingBag, type: "create" as const },
  {                    labelKey: "nav.updates",   icon: Bell,    type: "updates" as const },
  {                    labelKey: "nav.you",        icon: User,    type: "you"    as const },
] as const;

export type MobileTab = (typeof mobileBottomTabs)[number];

export const articleNavItems: NavItem[] = [
  { href: "/articles/my", labelKey: "nav.my_articles", icon: FileText, authRequired: true },
  { href: "/articles/new", labelKey: "nav.new_article", icon: FileText, authRequired: true },
];
