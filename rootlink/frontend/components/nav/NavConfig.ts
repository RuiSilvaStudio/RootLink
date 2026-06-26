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
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  authRequired?: boolean;
  staffOnly?: boolean;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

export const discoverGroup: NavGroup = {
  labelKey: "nav.discover",
  items: [
    { href: "/search", labelKey: "nav.search", icon: Search },
    { href: "/groups", labelKey: "nav.groups", icon: Users },
    { href: "/events", labelKey: "nav.events", icon: CalendarDays },
    { href: "/network", labelKey: "nav.network", icon: Network },
    { href: "/entities", labelKey: "nav.entities", icon: Building2 },
  ],
};

export const growGroup: NavGroup = {
  labelKey: "nav.grow",
  items: [
    { href: "/plants", labelKey: "nav.plants", icon: Leaf },
    { href: "/learning", labelKey: "nav.learning", icon: BookOpen },
    { href: "/tools", labelKey: "nav.tools", icon: Wrench },
  ],
};

export const exchangeGroup: NavGroup = {
  labelKey: "nav.exchange",
  items: [
    { href: "/marketplace", labelKey: "nav.marketplace", icon: ShoppingBag },
    { href: "/composting", labelKey: "nav.composting", icon: Sprout },
    { href: "/upcycling", labelKey: "nav.upcycling", icon: RefreshCw },
  ],
};

export const desktopDropdowns: NavGroup[] = [discoverGroup, growGroup, exchangeGroup];

export const mobileBottomTabs: NavItem[] = [
  { href: "/", labelKey: "nav.home", icon: Leaf },
  { href: "/search", labelKey: "nav.discover", icon: Search },
  { href: "/marketplace", labelKey: "nav.exchange", icon: ShoppingBag },
  { href: "/learning", labelKey: "nav.grow", icon: BookOpen },
  { href: "/profile", labelKey: "nav.profile", icon: MessageCircle },
];
