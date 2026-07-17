/**
 * Typed shapes for the Groups feature API.
 * Mirrors backend schemas in rootlink/backend/app/schemas/group.py.
 */

export interface Group {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  description_long: string | null;
  conduct: string | null;
  category: string | null;
  family: string | null;
  /** JSON array of "Família / Item" strings */
  categories: string | null;
  image_url: string | null;
  logo_url: string | null;
  location: string | null;
  group_type: "organic" | "structured";
  entity_id: number | null;
  is_open: boolean;
  /** JSON object of booleans — true = public, false = members-only */
  visibility_config: string | null;
  membership_config: string | null;
  created_by: number;
  created_at: string | null;
  status: "active" | "archived";
}

export interface GroupViewer {
  is_member: boolean;
  is_manager: boolean;
  is_owner: boolean;
  is_founder: boolean;
  role: string | null;
  member_id: number | null;
  has_pending_request: boolean;
  /** Resolved visibility config (defaults merged) — true = public */
  visibility: Record<string, boolean>;
}

export interface GroupMember {
  id: number;
  group_id: number;
  user_id: number;
  role: "owner" | "staff" | "member" | string;
  created_at: string | null;
  user_name: string | null;
  user_avatar: string | null;
}

export interface GroupContact {
  id: number;
  group_id: number;
  label: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hours: string | null;
  is_public: boolean;
}

export interface GroupBoardMember {
  id: number;
  group_id: number;
  body_name: string;
  member_name: string;
  role: string | null;
  term_start: string | null;
  term_end: string | null;
  display_order: number;
}

export interface GroupDocument {
  id: number;
  group_id: number;
  title: string;
  file_url: string;
  doc_type: string;
  is_public: boolean;
  display_order: number;
}

export interface GroupProgram {
  id: number;
  group_id: number;
  name: string;
  description: string | null;
  display_order: number;
}

export interface GroupProgramSubField {
  id: number;
  program_id: number;
  name: string;
  description: string | null;
  parent_id: number | null;
  display_order: number;
}

export interface GroupAnnouncement {
  id: number;
  group_id: number;
  author_id: number;
  body: string;
  created_at: string | null;
}

export interface GroupChatLink {
  id: number;
  group_id: number;
  name: string;
  url: string;
  description: string | null;
  display_order: number;
}

export interface GroupInvite {
  id: number;
  group_id: number;
  invited_by: number;
  invited_user_id: number | null;
  invite_token: string;
  method: "link" | "platform" | "qrEvent" | "prospectQR" | string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled" | string;
  expires_at: string | null;
  created_at: string | null;
}

export interface GroupInviteInfo {
  status: string;
  method: string;
  targeted: boolean;
  group: {
    name: string;
    slug: string;
    image_url: string | null;
    logo_url: string | null;
    description: string | null;
  };
}

export interface GroupJoinRequest {
  id: number;
  group_id: number;
  user_id: number;
  note: string | null;
  status: string;
  created_at: string | null;
  user_name: string | null;
  user_avatar: string | null;
}

export interface GroupContentLink {
  content_id: number;
  linked_by: number;
  is_public: boolean;
  created_at: string | null;
  title: string | null;
  image_url: string | null;
  date: string | null;
  location: string | null;
}

export interface GroupGalleryItem {
  id: number;
  group_id: number;
  image_url: string;
  caption: string | null;
  album: string | null;
  uploaded_by: number;
  display_order: number;
}

export interface GroupBadge {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  group_type: string;
}

/** Parse the categories JSON column safely. */
export function parseCategories(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Parse a visibility/membership config column safely. */
export function parseConfig(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}


export interface GroupGraduationRequest {
  id: number;
  group_id: number;
  requested_by: number;
  nipc: string;
  legal_form: string;
  organization_name: string;
  certificate_url: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string | null;
}
