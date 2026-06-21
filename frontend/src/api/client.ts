const API_BASE = '/api';

let authToken: string | null = localStorage.getItem('token');

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

export function getToken(): string | null {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data as T;
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ id: number; name: string; email: string; isSuperAdmin: boolean; token: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    ),
  register: (name: string, email: string, password: string, address?: string, maxGuests?: number) =>
    request<{ id: number; name: string; email: string; isSuperAdmin: boolean; token: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ name, email, password, address, maxGuests }),
      }
    ),
  me: () =>
    request<{ id: number; name: string; email: string; isGuest: boolean; isSuperAdmin: boolean }>(
      '/auth/me'
    ),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string; token: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

// Users
export const users = {
  list: () => request<any[]>('/users'),
  get: (id: number) => request<any>(`/users/${id}`),
  update: (id: number, data: any) =>
    request<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: number) => request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' }),
  convert: (id: number, data: { password: string; address?: string; maxGuests?: number }) =>
    request<{ id: number; name: string; email: string; token: string }>(`/users/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  toggleSuperAdmin: (id: number, isSuperAdmin: boolean) =>
    request<{ id: number; name: string; email: string; isSuperAdmin: boolean }>(
      `/users/${id}/super-admin`,
      {
        method: 'PUT',
        body: JSON.stringify({ isSuperAdmin }),
      }
    ),
};

// Groups
export const groups = {
  list: () => request<any[]>('/groups'),
  my: () => request<any[]>('/groups/my'),
  get: (id: number) => request<any>(`/groups/${id}`),
  create: (data: { name: string; description?: string; meetingCreation?: string }) =>
    request<{ id: number; inviteCode: string }>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: { name?: string; description?: string; meetingCreation?: string }) =>
    request<any>(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ success: boolean }>(`/groups/${id}`, { method: 'DELETE' }),
  leave: (id: number) => request<{ success: boolean }>(`/groups/${id}/leave`, { method: 'POST' }),
  members: (id: number) => request<any[]>(`/groups/${id}/members`),
  addMember: (groupId: number, userId: number, role?: string) =>
    request<any>(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }),
  removeMember: (groupId: number, userId: number) =>
    request<{ success: boolean }>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  changeRole: (groupId: number, userId: number, role: string) =>
    request<any>(`/groups/${groupId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  createInvitation: (groupId: number, maxUses?: number, expiresAt?: string) =>
    request<{ code: string }>(`/groups/${groupId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ maxUses, expiresAt }),
    }),
  listInvitations: (groupId: number) => request<any[]>(`/groups/${groupId}/invitations`),
  scores: (groupId: number) => request<any[]>(`/groups/${groupId}/scores`),
  matrix: (groupId: number) => request<any[]>(`/groups/${groupId}/matrix`),
  recalculate: (groupId: number) =>
    request<{ success: boolean }>(`/groups/${groupId}/recalculate`, { method: 'POST' }),
};

// Join
export const join = {
  lookup: (code: string) =>
    request<{ type: string; group: { id: number; name: string; description: string } }>(
      `/join/${code}`
    ),
  join: (code: string) =>
    request<{ success: boolean; groupId: number }>(`/join/${code}`, { method: 'POST' }),
};

// Meetings
export const meetings = {
  list: (groupId?: number) => request<any[]>(`/meetings${groupId ? `?group_id=${groupId}` : ''}`),
  my: () => request<any[]>('/meetings/my'),
  get: (id: number) => request<any>(`/meetings/${id}`),
  create: (groupId: number, data: { date: string; deadline: string }) =>
    request<any>(`/meetings/group/${groupId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { date?: string; deadline?: string }) =>
    request<any>(`/meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ success: boolean }>(`/meetings/${id}`, { method: 'DELETE' }),
  groupMeetings: (groupId: number) => request<any[]>(`/meetings/group/${groupId}`),
};

// Responses
export const responses = {
  list: (meetingId: number) => request<any[]>(`/meetings/${meetingId}/responses`),
  create: (meetingId: number, hostWish: string) =>
    request<any>(`/meetings/${meetingId}/responses`, {
      method: 'POST',
      body: JSON.stringify({ hostWish }),
    }),
  updateMine: (meetingId: number, hostWish: string) =>
    request<any>(`/meetings/${meetingId}/responses/me`, {
      method: 'PUT',
      body: JSON.stringify({ hostWish }),
    }),
  deleteMine: (meetingId: number) =>
    request<{ success: boolean }>(`/meetings/${meetingId}/responses/me`, { method: 'DELETE' }),
};

// RSVP
export const rsvp = {
  lookup: (token: string) =>
    request<{
      valid: boolean;
      meetingId?: number;
      userId?: number;
      userName?: string;
      meetingDate?: string;
      deadline?: string;
      reason?: string;
    }>(`/rsvp/${token}`),
  submit: (token: string, hostWish: string) =>
    request<{ success: boolean }>(`/rsvp/${token}`, {
      method: 'POST',
      body: JSON.stringify({ hostWish }),
    }),
};

// Assignment
export const assignment = {
  autoAssign: (meetingId: number) =>
    request<{ success: boolean; assignments: any[] }>(`/assignment/${meetingId}/assign`, {
      method: 'POST',
    }),
  get: (meetingId: number) =>
    request<{ meetingId: number; hostGroups: any; unassigned: any[] }>(`/assignment/${meetingId}`),
  manual: (meetingId: number, assignments: { userId: number; assignedHost: number | null }[]) =>
    request<{ success: boolean }>(`/assignment/${meetingId}`, {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    }),
};

// Admin
export const admin = {
  freeze: (meetingId: number) =>
    request<{ success: boolean }>(`/admin/meetings/${meetingId}/freeze`, { method: 'POST' }),
  remind: (meetingId: number) =>
    request<{ success: boolean }>(`/admin/meetings/${meetingId}/remind`, { method: 'POST' }),
  recalculateScores: () =>
    request<{ success: boolean }>('/admin/recalculate-scores', { method: 'POST' }),
  sendRsvp: (meetingId: number) =>
    request<{ success: boolean }>(`/admin/meetings/${meetingId}/send-rsvp`, { method: 'POST' }),
};

// Public
export const publicApi = {
  activeMeetings: () => request<any[]>('/public/meetings/active'),
  register: (
    meetingId: number,
    data: { name: string; email: string; hostWish: string; diet?: string }
  ) =>
    request<{ success: boolean; userId: number; isGuest: boolean }>(
      `/public/meetings/${meetingId}/register`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
};

// Feature Requests
export const featureRequests = {
  create: (data: { type: string; title: string; description: string }) =>
    request<any>('/feature-requests', { method: 'POST', body: JSON.stringify(data) }),
  list: (filters?: { status?: string; type?: string }) =>
    request<any[]>(
      `/feature-requests${filters ? `?${new URLSearchParams(filters as any).toString()}` : ''}`
    ),
  my: () => request<any[]>('/feature-requests/my'),
  update: (id: number, data: { status?: string; priority?: string }) =>
    request<any>(`/feature-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/feature-requests/${id}`, { method: 'DELETE' }),
};
