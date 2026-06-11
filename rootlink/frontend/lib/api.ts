const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
    throw new Error(err.detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    register: (data: { email: string; name: string; password: string }) =>
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
      content_type?: string;
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      qs.set("q", params.q);
      if (params.category) qs.set("category", params.category);
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
    list: () => request<any[]>("/api/groups/"),
    search: (q: string, limit = 5) => request<any[]>(`/api/groups/search?q=${encodeURIComponent(q)}&limit=${limit}`),
    get: (id: number) => request<any>(`/api/groups/${id}`),
    create: (data: any) =>
      request<any>("/api/groups/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    join: (id: number) =>
      request<any>(`/api/groups/${id}/join`, { method: "POST" }),
    leave: (id: number) =>
      request<void>(`/api/groups/${id}/leave`, { method: "DELETE" }),
    members: (id: number) => request<any[]>(`/api/groups/${id}/members`),
  },
  events: {
    list: (upcoming = true, category?: string, group_id?: number) => {
      const qs = new URLSearchParams();
      qs.set("upcoming", String(upcoming));
      if (category) qs.set("category", category);
      if (group_id) qs.set("group_id", String(group_id));
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
  },
  learning: {
    courses: {
      list: (category?: string) => {
        const qs = category ? `?category=${category}` : "";
        return request<any[]>(`/api/learning/courses${qs}`);
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
    list: (contentId: number) =>
      request<any[]>(`/api/comments/${contentId}`),
    create: (data: { content_id: number; parent_id?: number | undefined; body: string }) =>
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
    feed: (limit = 20, offset = 0) =>
      request<any[]>(`/api/social/feed?limit=${limit}&offset=${offset}`),
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
    listUsers: (params?: { q?: string; role?: string }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("q", params.q);
      if (params?.role) qs.set("role", params.role);
      return request<any[]>(`/api/admin/users?${qs}`);
    },
    updateUserRole: (userId: number, role: string) =>
      request<any>(`/api/admin/users/${userId}/role?role=${role}`, { method: "PATCH" }),
    resetPassword: (userId: number, password: string) =>
      request<any>(`/api/admin/users/${userId}/password?password=${encodeURIComponent(password)}`, { method: "PATCH" }),
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
    deleteGroup: (id: number) =>
      request<void>(`/api/admin/groups/${id}`, { method: "DELETE" }),
    listComments: () => request<any[]>("/api/admin/comments"),
    deleteComment: (id: number) =>
      request<void>(`/api/admin/comments/${id}`, { method: "DELETE" }),
    broadcast: (message: string) =>
      request<{ sent_to: number }>(`/api/admin/broadcast?message=${encodeURIComponent(message)}`, { method: "POST" }),
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
};
