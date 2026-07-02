const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const error: any = new Error(err.detail || "Request failed");
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    register: (data: { email: string; name: string; password: string; account_type?: string; entity_type?: string; registration_number?: string; services?: string[]; service_area?: string; modality?: string; certifications?: string[] }) =>
      request<{ access_token: string; token_type: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      request<{ access_token: string; token_type: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: () => request<any>("/api/auth/me"),
    update: (data: any) =>
      request<any>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },
  content: {
    search: (params: {
      q: string;
      category?: string;
      family?: string;
      content_type?: string;
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      qs.set("q", params.q);
      if (params.category) qs.set("category", params.category);
      if (params.family) qs.set("family", params.family);
      if (params.content_type) qs.set("content_type", params.content_type);
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.offset) qs.set("offset", String(params.offset));
      return request<{
        results: Array<{
          content: any;
          score: number;
        }>;
        total: number;
        query: string;
      }>(`/api/content/search?${qs}`);
    },
    recent: (limit = 20) =>
      request<any[]>(`/api/content/recent?limit=${limit}`),
    popular: (limit = 10) =>
      request<any[]>(`/api/content/popular?limit=${limit}`),
    trendingSearches: (limit = 10) =>
      request<{ query: string; count: number }[]>(`/api/content/trending-searches?limit=${limit}`),
    publicStats: () =>
      request<{ users: number; content: number; groups: number; events: number; courses: number }>("/api/content/stats/public"),
    byCategory: (category: string, limit = 20) =>
      request<any[]>(`/api/content/by-category/${category}?limit=${limit}`),
    get: (id: number) => request<any>(`/api/content/${id}`),
    index: (data: any) =>
      request<any>("/api/content/index", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    bookmarks: {
      list: () => request<any[]>("/api/content/bookmarks"),
      create: (data: { content_id: number; tags?: string[] }) =>
        request<any>("/api/content/bookmarks", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      delete: (id: number) =>
        request<void>(`/api/content/bookmarks/${id}`, { method: "DELETE" }),
    },
  },
  groups: {
    list: (limit?: number, offset?: number, family?: string, category?: string) => {
      const qs = new URLSearchParams();
      if (limit) qs.set("limit", String(limit));
      if (offset) qs.set("offset", String(offset));
      if (family) qs.set("family", family);
      if (category) qs.set("category", category);
      const params = qs.toString();
      return request<any[]>(`/api/groups/${params ? `?${params}` : ""}`);
    },
    categories: () => request<any[]>("/api/taxonomy/families"),
    search: (q: string, limit = 5) => request<any[]>(`/api/groups/search?q=${encodeURIComponent(q)}&limit=${limit}`),
    get: (id: number) => request<any>(`/api/groups/${id}`),
    create: (data: any) =>
      request<any>("/api/groups/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request<any>(`/api/groups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    join: (id: number) =>
      request<any>(`/api/groups/${id}/join`, { method: "POST" }),
    leave: (id: number) =>
      request<void>(`/api/groups/${id}/leave`, { method: "DELETE" }),
    members: (id: number) => request<any[]>(`/api/groups/${id}/members`),
  },
  events: {
    list: (upcoming = true, category?: string, group_id?: number, status?: string, family?: string) => {
      const qs = new URLSearchParams();
      qs.set("upcoming", String(upcoming));
      if (category) qs.set("category", category);
      if (group_id) qs.set("group_id", String(group_id));
      if (status) qs.set("status", status);
      if (family) qs.set("family", family);
      return request<any[]>(`/api/events/?${qs}`);
    },
    get: (id: number) => request<any>(`/api/events/${id}`),
    create: (data: any) =>
      request<any>("/api/events/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request<any>(`/api/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/api/events/${id}`, { method: "DELETE" }),
    rsvp: (id: number) =>
      request<any>(`/api/events/${id}/rsvp`, { method: "POST" }),
    cancelRsvp: (id: number) =>
      request<void>(`/api/events/${id}/rsvp`, { method: "DELETE" }),
    attendees: (id: number) =>
      request<any[]>(`/api/events/${id}/attendees`),
    myRsvps: () => request<any[]>("/api/events/my/rsvps"),
    // Venue
    getVenue: (id: number) => request<any>(`/api/events/${id}/venue`),
    upsertVenue: (id: number, data: any) =>
      request<any>(`/api/events/${id}/venue`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    // Amenities
    getAmenities: (id: number) => request<any[]>(`/api/events/${id}/amenities`),
    createAmenity: (id: number, data: any) =>
      request<any>(`/api/events/${id}/amenities`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateAmenity: (id: number, amenityId: number, data: any) =>
      request<any>(`/api/events/${id}/amenities/${amenityId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteAmenity: (id: number, amenityId: number) =>
      request<void>(`/api/events/${id}/amenities/${amenityId}`, { method: "DELETE" }),
    // Schedule
    getSchedule: (id: number) => request<any[]>(`/api/events/${id}/schedule`),
    createScheduleItem: (id: number, data: any) =>
      request<any>(`/api/events/${id}/schedule`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateScheduleItem: (id: number, itemId: number, data: any) =>
      request<any>(`/api/events/${id}/schedule/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteScheduleItem: (id: number, itemId: number) =>
      request<void>(`/api/events/${id}/schedule/${itemId}`, { method: "DELETE" }),
    // Sponsors
    getSponsors: (id: number, visibleOnly = false) =>
      request<any[]>(`/api/events/${id}/sponsors?visible_only=${visibleOnly}`),
    createSponsor: (id: number, data: any) =>
      request<any>(`/api/events/${id}/sponsors`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateSponsor: (id: number, sponsorId: number, data: any) =>
      request<any>(`/api/events/${id}/sponsors/${sponsorId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteSponsor: (id: number, sponsorId: number) =>
      request<void>(`/api/events/${id}/sponsors/${sponsorId}`, { method: "DELETE" }),
    // Vendors
    getVendors: (id: number, visibleOnly = false) =>
      request<any[]>(`/api/events/${id}/vendors?visible_only=${visibleOnly}`),
    createVendor: (id: number, data: any) =>
      request<any>(`/api/events/${id}/vendors`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateVendor: (id: number, vendorId: number, data: any) =>
      request<any>(`/api/events/${id}/vendors/${vendorId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteVendor: (id: number, vendorId: number) =>
      request<void>(`/api/events/${id}/vendors/${vendorId}`, { method: "DELETE" }),
    // Donations
    getDonations: (id: number) => request<any[]>(`/api/events/${id}/donations`),
    getDonationStats: (id: number) => request<any>(`/api/events/${id}/donations/stats`),
    donate: (id: number, data: any) =>
      request<any>(`/api/events/${id}/donate`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    // Tickets
    purchaseTicket: (id: number, data: any) =>
      request<any>(`/api/events/${id}/tickets/purchase`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    myTicket: (id: number) => request<any>(`/api/events/${id}/tickets/my`),
    checkIn: (id: number, ticketId: number) =>
      request<any>(`/api/events/${id}/check-in/${ticketId}`, { method: "POST" }),
  },
  learning: {
    courses: {
      list: (category?: string, family?: string) => {
        const qs = new URLSearchParams();
        if (category) qs.set("category", category);
        if (family) qs.set("family", family);
        const params = qs.toString();
        return request<any[]>(`/api/learning/courses${params ? `?${params}` : ""}`);
      },
      get: (id: number) => request<any>(`/api/learning/courses/${id}`),
      create: (data: any) =>
        request<any>("/api/learning/courses", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      update: (id: number, data: any) =>
        request<any>(`/api/learning/courses/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        }),
      delete: (id: number) =>
        request<void>(`/api/learning/courses/${id}`, { method: "DELETE" }),
      my: () => request<any[]>("/api/learning/my/courses"),
      lessons: {
        list: (courseId: number) =>
          request<any[]>(`/api/learning/courses/${courseId}/lessons`),
        create: (courseId: number, data: any) =>
          request<any>(`/api/learning/courses/${courseId}/lessons`, {
            method: "POST",
            body: JSON.stringify(data),
          }),
        update: (id: number, data: any) =>
          request<any>(`/api/learning/lessons/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
          }),
        delete: (id: number) =>
          request<void>(`/api/learning/lessons/${id}`, { method: "DELETE" }),
        markComplete: (id: number) =>
          request<any>(`/api/learning/lessons/${id}/progress`, {
            method: "POST",
          }),
      },
      enroll: (courseId: number) =>
        request<any>(`/api/learning/courses/${courseId}/enroll`, {
          method: "POST",
        }),
    },
    paths: {
      list: () => request<any[]>("/api/learning/paths"),
      get: (id: number) => request<any>(`/api/learning/paths/${id}`),
      create: (data: any) =>
        request<any>("/api/learning/paths", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      update: (id: number, data: any) =>
        request<any>(`/api/learning/paths/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        }),
      delete: (id: number) =>
        request<void>(`/api/learning/paths/${id}`, { method: "DELETE" }),
      addCourse: (pathId: number, data: any) =>
        request<any>(`/api/learning/paths/${pathId}/courses`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      removeCourse: (pathId: number, courseId: number) =>
        request<void>(`/api/learning/paths/${pathId}/courses/${courseId}`, { method: "DELETE" }),
      getCourses: (pathId: number) =>
        request<any[]>(`/api/learning/paths/${pathId}/courses`),
      my: () => request<any[]>("/api/learning/my/paths"),
    },
    myEnrollments: () => request<any[]>("/api/learning/my/enrollments"),
  },
  comments: {
    list: (entityType: string, entityId: number) =>
      request<any[]>(`/api/comments/?entity_type=${entityType}&entity_id=${entityId}`),
    create: (data: { entity_type: string; entity_id: number; parent_id?: number | undefined; body: string }) =>
      request<any>("/api/comments/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/api/comments/${id}`, { method: "DELETE" }),
  },
  users: {
    search: (params: { q?: string; skill?: string; interest?: string }) => {
      const qs = new URLSearchParams();
      if (params.q) qs.set("q", params.q);
      if (params.skill) qs.set("skill", params.skill);
      if (params.interest) qs.set("interest", params.interest);
      return request<any[]>(`/api/users/search?${qs}`);
    },
    match: () => request<any[]>("/api/users/match"),
    nearby: (lat: number, lng: number, radiusKm = 50) =>
      request<any[]>(`/api/users/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`),
    get: (id: number) => request<any>(`/api/users/${id}`),
    activity: (id: number) => request<any>(`/api/users/${id}/activity`),
    entities: (params?: { q?: string; account_type?: string; entity_type?: string; family?: string; region?: string; verified_only?: boolean; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("q", params.q);
      if (params?.account_type) qs.set("account_type", params.account_type);
      if (params?.entity_type) qs.set("entity_type", params.entity_type);
      if (params?.family) qs.set("family", params.family);
      if (params?.region) qs.set("region", params.region);
      if (params?.verified_only) qs.set("verified_only", "true");
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      return request<any[]>(`/api/users/entities?${qs}`);
    },
    entityStats: () => request<any>("/api/users/entities/stats"),
    stats: {
      regions: () => request<{ region: string; count: number }[]>("/api/users/stats/regions"),
      skills: () => request<{ skill: string; count: number }[]>("/api/users/stats/skills"),
    },
  },
  messages: {
    conversations: () => request<any[]>("/api/messages/conversations"),
    getMessages: (conversationId: number) =>
      request<any[]>(`/api/messages/conversations/${conversationId}`),
    send: (userId: number, body: string) =>
      request<any>(`/api/messages/send/${userId}`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
  },
  social: {
    follow: (userId: number) =>
      request<void>(`/api/social/follow/${userId}`, { method: "POST" }),
    unfollow: (userId: number) =>
      request<void>(`/api/social/follow/${userId}`, { method: "DELETE" }),
    followers: () => request<any[]>("/api/social/followers"),
    following: () => request<any[]>("/api/social/following"),
    feed: (limit = 30) =>
      request<{ following: any[]; discover: any[] }>(`/api/social/feed?limit=${limit}`),
  },
  notifications: {
    list: (unreadOnly = false) =>
      request<any[]>(`/api/notifications/?unread_only=${unreadOnly}`),
    unreadCount: () =>
      request<{ count: number }>("/api/notifications/unread-count"),
    markAllRead: () =>
      request<void>("/api/notifications/read-all", { method: "POST" }),
    markRead: (id: number) =>
      request<void>(`/api/notifications/${id}/read`, { method: "POST" }),
  },
  admin: {
    dashboard: () => request<any>("/api/admin/dashboard"),
    listUsers: (params?: { q?: string; role?: string; account_type?: string }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("q", params.q);
      if (params?.role) qs.set("role", params.role);
      if (params?.account_type) qs.set("account_type", params.account_type);
      return request<any[]>(`/api/admin/users?${qs}`);
    },
    updateUserRole: (userId: number, role: string) =>
      request<any>(`/api/admin/users/${userId}/role?role=${role}`, { method: "PATCH" }),
    resetPassword: (userId: number, password: string) =>
      request<any>(`/api/admin/users/${userId}/password?password=${encodeURIComponent(password)}`, { method: "PATCH" }),
    verifyUser: (userId: number) =>
      request<any>(`/api/admin/users/${userId}/verify`, { method: "POST" }),
    unverifyUser: (userId: number) =>
      request<any>(`/api/admin/users/${userId}/unverify`, { method: "POST" }),
    listContent: (params?: { q?: string; verification_status?: string; content_type?: string }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("q", params.q);
      if (params?.verification_status) qs.set("verification_status", params.verification_status);
      if (params?.content_type) qs.set("content_type", params.content_type);
      return request<any[]>(`/api/admin/content?${qs}`);
    },
    approveContent: (id: number) =>
      request<any>(`/api/admin/content/${id}/approve`, { method: "PATCH" }),
    rejectContent: (id: number) =>
      request<any>(`/api/admin/content/${id}/reject`, { method: "PATCH" }),
    reviewQueue: (params?: { limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      return request<any[]>(`/api/admin/review-queue?${qs}`);
    },
    trendingSearches: (limit?: number) =>
      request<{ query: string; count: number }[]>(`/api/admin/trending-searches${limit ? `?limit=${limit}` : ""}`),
    updateContentImage: (id: number, image_url: string) =>
      request<any>(`/api/admin/content/${id}/image?image_url=${encodeURIComponent(image_url)}`, { method: "PATCH" }),
    updateContent: (id: number, data: any) => {
      const qs = new URLSearchParams();
      if (data.title) qs.set("title", data.title);
      if (data.summary) qs.set("summary", data.summary);
      if (data.category) qs.set("category", data.category);
      if (data.content_type) qs.set("content_type", data.content_type);
      return request<any>(`/api/admin/content/${id}?${qs}`, { method: "PATCH" });
    },
    deleteContent: (id: number) =>
      request<void>(`/api/admin/content/${id}`, { method: "DELETE" }),
    listGroups: (params?: { q?: string }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("q", params.q);
      return request<any[]>(`/api/admin/groups?${qs}`);
    },
    archiveGroup: (id: number) =>
      request<any>(`/api/admin/groups/${id}/archive`, { method: "POST" }),
    deleteGroup: (id: number) =>
      request<void>(`/api/admin/groups/${id}`, { method: "DELETE" }),
    listComments: (params?: { entity_type?: string }) => {
      const qs = new URLSearchParams();
      if (params?.entity_type) qs.set("entity_type", params.entity_type);
      const query = qs.toString();
      return request<any[]>(`/api/admin/comments${query ? `?${query}` : ""}`);
    },
    deleteComment: (id: number) =>
      request<void>(`/api/admin/comments/${id}`, { method: "DELETE" }),
    broadcast: (message: string) =>
      request<{ sent_to: number }>(`/api/admin/broadcast?message=${encodeURIComponent(message)}`, { method: "POST" }),
    // Tickets
    listTickets: (params?: { event_id?: number; ticket_type?: string; payment_status?: string; q?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.event_id) qs.set("event_id", String(params.event_id));
      if (params?.ticket_type) qs.set("ticket_type", params.ticket_type);
      if (params?.payment_status) qs.set("payment_status", params.payment_status);
      if (params?.q) qs.set("q", params.q);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      return request<any[]>(`/api/admin/tickets?${qs}`);
    },
    ticketStats: () => request<any>("/api/admin/tickets/stats"),
    // Donations
    listDonations: (params?: { event_id?: number; is_anonymous?: boolean; payment_status?: string; q?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.event_id) qs.set("event_id", String(params.event_id));
      if (params?.is_anonymous !== undefined) qs.set("is_anonymous", String(params.is_anonymous));
      if (params?.payment_status) qs.set("payment_status", params.payment_status);
      if (params?.q) qs.set("q", params.q);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      return request<any[]>(`/api/admin/donations?${qs}`);
    },
    donationStats: () => request<any>("/api/admin/donations/stats"),
    // Sponsors
    listSponsors: (params?: { event_id?: number; tier?: string; agreement_status?: string; is_active?: boolean; q?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.event_id) qs.set("event_id", String(params.event_id));
      if (params?.tier) qs.set("tier", params.tier);
      if (params?.agreement_status) qs.set("agreement_status", params.agreement_status);
      if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
      if (params?.q) qs.set("q", params.q);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      return request<any[]>(`/api/admin/sponsors?${qs}`);
    },
    updateSponsor: (id: number, data: any) =>
      request<any>(`/api/admin/sponsors/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteSponsor: (id: number) =>
      request<void>(`/api/admin/sponsors/${id}`, { method: "DELETE" }),
    // Vendors
    listVendors: (params?: { event_id?: number; service_type?: string; status?: string; agreement_status?: string; q?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.event_id) qs.set("event_id", String(params.event_id));
      if (params?.service_type) qs.set("service_type", params.service_type);
      if (params?.status) qs.set("status", params.status);
      if (params?.agreement_status) qs.set("agreement_status", params.agreement_status);
      if (params?.q) qs.set("q", params.q);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      return request<any[]>(`/api/admin/vendors?${qs}`);
    },
    updateVendor: (id: number, data: any) =>
      request<any>(`/api/admin/vendors/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteVendor: (id: number) =>
      request<void>(`/api/admin/vendors/${id}`, { method: "DELETE" }),
    // Settings / Config
    listSettings: (category?: string) => {
      const qs = new URLSearchParams();
      if (category) qs.set("category", category);
      const query = qs.toString();
      return request<any[]>(`/api/admin/settings${query ? `?${query}` : ""}`);
    },
    getSetting: (key: string) => request<any>(`/api/admin/settings/${key}`),
    updateSetting: (key: string, value: any, description?: string) =>
      request<any>(`/api/admin/settings/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value, description }),
      }),
  },
  // Taxonomy
  taxonomy: {
    tree: () => request<any[]>("/api/taxonomy/"),
    families: () => request<any[]>("/api/taxonomy/families"),
    categories: (familyValue: string) => request<any[]>(`/api/taxonomy/families/${familyValue}/categories`),
    // Admin
    adminListFamilies: () => request<any[]>("/api/taxonomy/admin/families"),
    adminCreateFamily: (data: any) => request<any>("/api/taxonomy/admin/families", { method: "POST", body: JSON.stringify(data) }),
    adminUpdateFamily: (id: number, data: any) => request<any>(`/api/taxonomy/admin/families/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    adminDeleteFamily: (id: number) => request<void>(`/api/taxonomy/admin/families/${id}`, { method: "DELETE" }),
    adminCreateCategory: (familyId: number, data: any) => request<any>(`/api/taxonomy/admin/families/${familyId}/categories`, { method: "POST", body: JSON.stringify(data) }),
    adminUpdateCategory: (id: number, data: any) => request<any>(`/api/taxonomy/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    adminDeleteCategory: (id: number) => request<void>(`/api/taxonomy/admin/categories/${id}`, { method: "DELETE" }),
  },
  // Marketplace
  marketplace: {
    list: (params?: { listing_type?: string; family?: string; category?: string; condition?: string; min_price?: number; max_price?: number; q?: string; sort?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.listing_type) qs.set("listing_type", params.listing_type);
      if (params?.family) qs.set("family", params.family);
      if (params?.category) qs.set("category", params.category);
      if (params?.condition) qs.set("condition", params.condition);
      if (params?.min_price !== undefined) qs.set("min_price", String(params.min_price));
      if (params?.max_price !== undefined) qs.set("max_price", String(params.max_price));
      if (params?.q) qs.set("q", params.q);
      if (params?.sort) qs.set("sort", params.sort);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      return request<any[]>(`/api/marketplace/listings?${qs}`);
    },
    get: (id: number) => request<any>(`/api/marketplace/listings/${id}`),
    create: (data: any) => request<any>("/api/marketplace/listings", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/marketplace/listings/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/marketplace/listings/${id}`, { method: "DELETE" }),
    my: () => request<any[]>("/api/marketplace/my/listings"),
    myOrders: () => request<any[]>("/api/marketplace/my/orders"),
    mySales: () => request<any[]>("/api/marketplace/my/sales"),
    purchase: (id: number) => request<any>(`/api/marketplace/listings/${id}/purchase`, { method: "POST" }),
    claim: (id: number) => request<any>(`/api/marketplace/listings/${id}/claim`, { method: "POST" }),
    completeOrder: (id: number) => request<any>(`/api/marketplace/orders/${id}/complete`, { method: "POST" }),
    cancelOrder: (id: number) => request<any>(`/api/marketplace/orders/${id}/cancel`, { method: "POST" }),
    sellerStatus: () => request<any>("/api/marketplace/seller/status"),
    sellerOnboard: () => request<any>("/api/marketplace/seller/onboard", { method: "POST" }),
    sellerDashboard: () => request<any>("/api/marketplace/seller/dashboard-link", { method: "POST" }),
  },
  // Waste Management
  waste: {
    hubs: (params?: { q?: string; region?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("q", params.q);
      if (params?.region) qs.set("region", params.region);
      if (params?.limit) qs.set("limit", String(params.limit));
      return request<any[]>(`/api/waste/hubs?${qs}`);
    },
    hub: (id: number) => request<any>(`/api/waste/hubs/${id}`),
    createHub: (data: any) => request<any>("/api/waste/hubs", { method: "POST", body: JSON.stringify(data) }),
    joinHub: (id: number) => request<any>(`/api/waste/hubs/${id}/join`, { method: "POST" }),
    leaveHub: (id: number) => request<void>(`/api/waste/hubs/${id}/leave`, { method: "DELETE" }),
    deposit: (hubId: number, data: any) => request<any>(`/api/waste/hubs/${hubId}/deposit`, { method: "POST", body: JSON.stringify(data) }),
    deposits: (hubId: number) => request<any[]>(`/api/waste/hubs/${hubId}/deposits`),
    upcycling: (params?: { q?: string; family?: string; difficulty?: string }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("q", params.q);
      if (params?.family) qs.set("family", params.family);
      if (params?.difficulty) qs.set("difficulty", params.difficulty);
      return request<any[]>(`/api/waste/upcycling?${qs}`);
    },
    upcyclingGet: (id: number) => request<any>(`/api/waste/upcycling/${id}`),
    upcyclingCreate: (data: any) => request<any>("/api/waste/upcycling", { method: "POST", body: JSON.stringify(data) }),
    challenges: () => request<any[]>("/api/waste/challenges"),
    createChallenge: (data: any) => request<any>("/api/waste/challenges", { method: "POST", body: JSON.stringify(data) }),
  },
  plants: {
    search: (params: { q?: string; plant_type?: string; genus?: string; family?: string; has_kc?: boolean; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params.q) qs.set("q", params.q);
      if (params.plant_type) qs.set("plant_type", params.plant_type);
      if (params.genus) qs.set("genus", params.genus);
      if (params.family) qs.set("family", params.family);
      if (params.has_kc) qs.set("has_kc", "true");
      if (params.limit) qs.set("limit", String(params.limit));
      return request<any[]>(`/api/plants/search?${qs}`);
    },
    get: (id: number) => request<any>(`/api/plants/${id}`),
    getDetail: (id: number) => request<any>(`/api/plants/${id}/detail`),
    create: (data: any) =>
      request<any>("/api/plants", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request<any>(`/api/plants/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/api/plants/${id}`, { method: "DELETE" }),
    crawlUtad: (scientificName: string) =>
      request<any>(`/api/plants/crawl-utad?scientific_name=${encodeURIComponent(scientificName)}`, {
        method: "POST",
      }),
    crawlUtadAll: () =>
      request<any>("/api/plants/crawl-utad-all", { method: "POST" }),
    irrigation: (data: {
      plant_id: number;
      eto_mm: number;
      growth_stage: string;
      area_sqm?: number;
      plants_count?: number;
    }) =>
      request<any>("/api/plants/irrigation", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    calendar: (params: { zone?: string; plant_type?: string; month?: number }) => {
      const qs = new URLSearchParams();
      if (params.zone) qs.set("zone", params.zone);
      if (params.plant_type) qs.set("plant_type", params.plant_type);
      if (params.month) qs.set("month", String(params.month));
      return request<any[]>(`/api/plants/calendar?${qs}`);
    },
  },
  farmersGuide: {
    get: (month: number, locale = "pt") =>
      request<{ month: number; tasks: Array<{ key: string; category: string; category_label: string; text: string }> }>(
        `/api/farmers-guide?month=${month}&locale=${locale}`
      ),
  },
  checklist: {
    list: (month?: number) => {
      const qs = month ? `?month=${month}` : "";
      return request<any[]>(`/api/checklist${qs}`);
    },
    create: (data: { month: number; task: string; sort_order?: number }) =>
      request<any>("/api/checklist", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: { task?: string; is_completed?: boolean; sort_order?: number; month?: number }) =>
      request<any>(`/api/checklist/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/api/checklist/${id}`, { method: "DELETE" }),
    presets: (month: number, zone?: string) => {
      const qs = new URLSearchParams({ month: String(month) });
      if (zone) qs.set("zone", zone);
      return request<{ generated: number; message: string }>(`/api/checklist/presets?${qs}`, { method: "POST" });
    },
  },
  crawl: {
    submitUrl: (data: { url: string; category: string; content_type?: string }) =>
      request<any>("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    searchAndCrawl: (data: { query: string; category: string; num_results?: number }) =>
      request<any[]>("/api/crawl/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  },
  external: {
    moon: () => request<{ phase: string; icon: string; illumination: number; agricultural_pt: string; agricultural_en: string; date: string }>("/api/external/moon"),
    sun: (lat: number, lng: number) => request<{ sunrise: string; sunset: string; day_length_hours: number; golden_hour_morning: string; golden_hour_evening: string }>(`/api/external/sun?lat=${lat}&lng=${lng}`),
    species: (q: string, limit = 5) => request<{ inaturalist: any[]; gbif: any[] }>(`/api/external/species?q=${encodeURIComponent(q)}&limit=${limit}`),
    speciesAutocomplete: (q: string, limit = 5) => request<any[]>(`/api/external/species/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`),
    speciesObservations: (taxonName: string, limit = 10) => request<any[]>(`/api/external/species/${encodeURIComponent(taxonName)}/observations?limit=${limit}`),
    speciesOccurrences: (taxonKey: number, limit = 20) => request<{ total: number; occurrences: any[] }>(`/api/external/species/${taxonKey}/occurrences?limit=${limit}`),
  },
  images: {
    upload: async (file: File, opts?: { source_type?: string; author?: string; license?: string; attribution_text?: string }) => {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);
      if (opts?.source_type) formData.append("source_type", opts.source_type);
      if (opts?.author) formData.append("author", opts.author);
      if (opts?.license) formData.append("license", opts.license);
      if (opts?.attribution_text) formData.append("attribution_text", opts.attribution_text);

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      const res = await fetch(`${API_URL}/api/images/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
      }
      return res.json();
    },
    fromUrl: (data: { url: string; source_type?: string; author?: string; license?: string; attribution_text?: string }) =>
      request<any>("/api/images/from-url", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (id: number) => request<any>(`/api/images/${id}`),
    delete: (id: number) =>
      request<void>(`/api/images/${id}`, { method: "DELETE" }),
    serveUrl: (id: number, size: "original" | "large" | "medium" | "thumb") => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      return `${API_URL}/api/images/${id}/serve/${size}`;
    },
    serveByHash: (hash: string, size: "original" | "large" | "medium" | "thumb") => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      return `${API_URL}/api/images/by-hash/${hash}/${size}`;
    },
  },

  articles: {
    create: (data: { title: string; summary?: string; body?: any; category?: string; family?: string; image_url?: string }) =>
      request<any>("/api/articles/", { method: "POST", body: JSON.stringify(data) }),
    get: (slug: string) => request<any>(`/api/articles/${slug}`),
    update: (id: number, data: { title?: string; summary?: string; body?: any; category?: string; family?: string; image_url?: string }) =>
      request<any>(`/api/articles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    publish: (id: number) => request<any>(`/api/articles/${id}/publish`, { method: "POST" }),
    appeal: (id: number) => request<any>(`/api/articles/${id}/appeal`, { method: "POST" }),
    delete: (id: number) => request<void>(`/api/articles/${id}`, { method: "DELETE" }),
    my: (opts?: { status?: string; limit?: number; offset?: number }) => {
      const params = new URLSearchParams();
      if (opts?.status) params.set("status", opts.status);
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.offset) params.set("offset", String(opts.offset));
      const qs = params.toString();
      return request<any[]>(`/api/articles/my${qs ? `?${qs}` : ""}`);
    },
    feed: (opts?: { category?: string; family?: string; limit?: number; offset?: number }) => {
      const params = new URLSearchParams();
      if (opts?.category) params.set("category", opts.category);
      if (opts?.family) params.set("family", opts.family);
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.offset) params.set("offset", String(opts.offset));
      const qs = params.toString();
      return request<{ articles: any[]; total: number; boosted_count: number }>(`/api/articles/feed${qs ? `?${qs}` : ""}`);
    },
    rankingTransparency: () => request<any>("/api/articles/ranking/transparency"),
  },

  contentTemplates: {
    list: (kind = "article") => request<any[]>(`/api/content-templates?kind=${kind}`),
    all: () => request<any[]>("/api/content-templates/all"),
    create: (data: any) => request<any>("/api/content-templates", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/content-templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/content-templates/${id}`, { method: "DELETE" }),
  },

  selfPublish: {
    eligibility: () => request<{ eligible: boolean; granted: boolean; agreed: boolean; email_verified: boolean; approved_count: number; threshold: number }>("/api/me/self-publish/eligibility"),
    accept: () => request<{ ok: boolean; agreed_at: string }>("/api/me/self-publish/accept", { method: "POST" }),
  },

  copy: {
    get: (locale: string) => request<Record<string, string>>(`/api/copy?locale=${locale}`),
    all: () => request<{ key: string; locale: string; value: string }[]>("/api/copy/all"),
    set: (key: string, locale: string, value: string) =>
      request<any>(`/api/copy/${encodeURIComponent(key)}?locale=${locale}`, { method: "PUT", body: JSON.stringify({ value }) }),
    revert: (key: string, locale: string) =>
      request<any>(`/api/copy/${encodeURIComponent(key)}?locale=${locale}`, { method: "DELETE" }),
  },

  legal: {
    // Public: always the last *published* snapshot. 404 if never published yet
    // — pages fall back to their bundled static copy (content/legal/*.ts) in
    // that case, so nothing is ever blank.
    get: (slug: "privacidade" | "termos" | "legal") =>
      request<import("@/content/legal/types").ApiLegalDocumentPublic>(`/api/legal/${slug}`),
  },

  adminLegal: {
    // super_admin only — draft/publish workflow for the 3 legal documents.
    list: () => request<import("@/content/legal/types").ApiLegalDocumentAdmin[]>("/api/admin/legal"),
    get: (slug: string) =>
      request<import("@/content/legal/types").ApiLegalDocumentAdmin>(`/api/admin/legal/${slug}`),
    update: (
      slug: string,
      body: { title: string; description: string; intro: string[]; sections: import("@/content/legal/types").LegalSection[] }
    ) =>
      request<import("@/content/legal/types").ApiLegalDocumentAdmin>(`/api/admin/legal/${slug}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    publish: (slug: string, body: { version: string; effective_date: string; summary: string }) =>
      request<import("@/content/legal/types").ApiLegalDocumentAdmin>(`/api/admin/legal/${slug}/publish`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  contentUi: {
    // Image/icon overrides for the Content UI Editor (site chrome only — see
    // discovery/mockups/content-ui-editor/briefing-to-build-local.md). Text
    // overrides reuse `api.copy` above unchanged.
    get: () =>
      request<Record<string, { kind: "image" | "icon"; value: any }>>("/api/content-ui"),
    setImage: (key: string, value: { url: string; alt: string }) =>
      request<any>(`/api/content-ui/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ kind: "image", value }),
      }),
    setIcon: (key: string, iconId: string) =>
      request<any>(`/api/content-ui/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ kind: "icon", value: { iconId } }),
      }),
    revert: (key: string) =>
      request<any>(`/api/content-ui/${encodeURIComponent(key)}`, { method: "DELETE" }),
  },

  ratings: {
    rate: (contentId: number, data: { reaction: string; tags?: string[] }) =>
      request<any>(`/api/content/${contentId}/rate`, { method: "POST", body: JSON.stringify(data) }),
    remove: (contentId: number) =>
      request<void>(`/api/content/${contentId}/rate`, { method: "DELETE" }),
    get: (contentId: number) =>
      request<{ content_id: number; up_count: number; down_count: number; top_tags: { tag: string; count: number }[]; user_reaction: string | null }>(`/api/content/${contentId}/ratings`),
  },

  points: {
    balance: () => request<{ balance: number; total_donated: number; boost_active: boolean; boost_expires_at: string | null }>(`/api/points/balance`),
    transactions: (opts?: { limit?: number; offset?: number }) => {
      const params = new URLSearchParams();
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.offset) params.set("offset", String(opts.offset));
      const qs = params.toString();
      return request<any[]>(`/api/points/transactions${qs ? `?${qs}` : ""}`);
    },
    donate: (data: { amount_euros: number; tier_name?: string }) =>
      request<{ checkout_url: string; session_id: string }>("/api/points/donate", { method: "POST", body: JSON.stringify(data) }),
    leaderboard: (limit?: number) => {
      const params = limit ? `?limit=${limit}` : "";
      return request<{ user_id: number; name: string; avatar_url: string | null; total_donated: number }[]>(`/api/points/leaderboard${params}`);
    },
    tiers: () => request<any>("/api/points/tiers"),
  },

  feeds: {
    connect: (data: { feed_url: string; site_url?: string; auto_sync?: boolean }) =>
      request<any>("/api/feeds/connect", { method: "POST", body: JSON.stringify(data) }),
    verify: (feedId: number) =>
      request<any>(`/api/feeds/${feedId}/verify`, { method: "POST" }),
    list: () => request<any[]>("/api/feeds/"),
    status: (feedId: number) => request<any>(`/api/feeds/${feedId}/status`),
    refresh: (feedId: number) => request<{ new_items: number; total_parsed: number }>(`/api/feeds/${feedId}/refresh`, { method: "POST" }),
    disconnect: (feedId: number) => request<void>(`/api/feeds/${feedId}`, { method: "DELETE" }),
  },
};
