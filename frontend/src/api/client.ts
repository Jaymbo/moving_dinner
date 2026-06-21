import type {
  AuthResponse,
  User,
  PublicUser,
  Group,
  GroupWithCounts,
  GroupMember,
  GroupInvitation,
  Meeting,
  MeetingWithCounts,
  MyMeeting,
  MeetingDetail,
  Response as ApiResponse,
  ResponseWithUser,
  Score,
  MatrixEntry,
  FeatureRequest,
  RsvpInfo,
  Assignment,
  AssignmentResult,
  AssignmentView,
  JoinLookup,
  PublicMeeting,
  HostWish,
  GroupRole,
  MeetingCreationPolicy,
  FeatureRequestType,
  FeatureRequestStatus,
  FeatureRequestPriority,
  ApiError,
} from '../types/api';

const API_BASE = '/api';

let authToken: string | null = localStorage.getItem('token');
let unauthorizedHandler: (() => void) | null = null;

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

/**
 * Register a callback that is invoked when the API returns a 401 response.
 * The AuthContext uses this to log the user out when their session expires.
 */
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, string[]>;

  constructor(message: string, status: number, code = 'UNKNOWN_ERROR', details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseErrorBody(res: Response): Promise<ApiError> {
  const text = await res.text();
  try {
    return JSON.parse(text) as ApiError;
  } catch {
    return { error: text || `Request failed: ${res.status}` };
  }
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

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const data = await parseErrorBody(res);

    if (res.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }

    throw new ApiRequestError(
      data.error || `Request failed: ${res.status}`,
      res.status,
      data.code,
      data.details
    );
  }

  // Some successful responses (e.g. empty bodies) may not be JSON.
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string, address?: string, maxGuests?: number) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, address, maxGuests }),
    }),
  me: () =>
    request<User>('/auth/me'),
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
  list: () => request<User[]>('/users'),
  get: (id: number) =>
    request<
      User & {
        groupMembers: { group: Group }[];
      }
    >(`/users/${id}`),
  update: (
    id: number,
    data: {
      name?: string;
      address?: string | null;
      maxGuests?: number | null;
      notes?: string | null;
      diet?: string | null;
    }
  ) =>
    request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: number) => request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' }),
  convert: (
    id: number,
    data: { password: string; address?: string | null; maxGuests?: number | null }
  ) =>
    request<AuthResponse>(`/users/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  toggleSuperAdmin: (id: number, isSuperAdmin: boolean) =>
    request<PublicUser>(`/users/${id}/super-admin`, {
      method: 'PUT',
      body: JSON.stringify({ isSuperAdmin }),
    }),
};

// Groups
export const groups = {
  list: () => request<GroupWithCounts[]>('/groups'),
  my: () => request<GroupWithCounts[]>('/groups/my'),
  get: (id: number) =>
    request<
      Group & {
        members: GroupMember[];
        _count: { members: number; meetings: number };
      }
    >(`/groups/${id}`),
  create: (data: { name: string; description?: string; meetingCreation?: MeetingCreationPolicy }) =>
    request<{ id: number; inviteCode: string }>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (
    id: number,
    data: { name?: string; description?: string | null; meetingCreation?: MeetingCreationPolicy }
  ) => request<Group>(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ success: boolean }>(`/groups/${id}`, { method: 'DELETE' }),
  leave: (id: number) => request<{ success: boolean }>(`/groups/${id}/leave`, { method: 'POST' }),
  members: (id: number) => request<GroupMember[]>(`/groups/${id}/members`),
  addMember: (groupId: number, userId: number, role?: GroupRole) =>
    request<GroupMember>(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }),
  removeMember: (groupId: number, userId: number) =>
    request<{ success: boolean }>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  changeRole: (groupId: number, userId: number, role: GroupRole) =>
    request<GroupMember>(`/groups/${groupId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  createInvitation: (groupId: number, maxUses?: number, expiresAt?: string) =>
    request<{ code: string }>(`/groups/${groupId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ maxUses, expiresAt }),
    }),
  listInvitations: (groupId: number) => request<GroupInvitation[]>(`/groups/${groupId}/invitations`),
  scores: (groupId: number) => request<Score[]>(`/groups/${groupId}/scores`),
  matrix: (groupId: number) => request<MatrixEntry[]>(`/groups/${groupId}/matrix`),
  recalculate: (groupId: number) =>
    request<{ success: boolean }>(`/groups/${groupId}/recalculate`, { method: 'POST' }),
};

// Join
export const join = {
  lookup: (code: string) => request<JoinLookup>(`/join/${code}`),
  join: (code: string) =>
    request<{ success: boolean; groupId: number }>(`/join/${code}`, { method: 'POST' }),
};

// Meetings
export const meetings = {
  list: (groupId?: number) =>
    request<MeetingWithCounts[]>(`/meetings${groupId ? `?group_id=${groupId}` : ''}`),
  my: () => request<MyMeeting[]>('/meetings/my'),
  get: (id: number) => request<MeetingDetail>(`/meetings/${id}`),
  create: (groupId: number, data: { date: string; deadline: string }) =>
    request<Meeting>(`/meetings/group/${groupId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { date?: string; deadline?: string }) =>
    request<Meeting>(`/meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ success: boolean }>(`/meetings/${id}`, { method: 'DELETE' }),
  groupMeetings: (groupId: number) => request<Meeting[]>(`/meetings/group/${groupId}`),
};

// Responses
export const responses = {
  list: (meetingId: number) => request<ResponseWithUser[]>(`/meetings/${meetingId}/responses`),
  create: (meetingId: number, hostWish: HostWish) =>
    request<ApiResponse>(`/meetings/${meetingId}/responses`, {
      method: 'POST',
      body: JSON.stringify({ hostWish }),
    }),
  updateMine: (meetingId: number, hostWish: HostWish) =>
    request<ApiResponse>(`/meetings/${meetingId}/responses/me`, {
      method: 'PUT',
      body: JSON.stringify({ hostWish }),
    }),
  deleteMine: (meetingId: number) =>
    request<{ success: boolean }>(`/meetings/${meetingId}/responses/me`, { method: 'DELETE' }),
};

// RSVP
export const rsvp = {
  lookup: (token: string) => request<RsvpInfo>(`/rsvp/${token}`),
  submit: (token: string, hostWish: HostWish) =>
    request<{ success: boolean }>(`/rsvp/${token}`, {
      method: 'POST',
      body: JSON.stringify({ hostWish }),
    }),
};

// Assignment
export const assignment = {
  autoAssign: (meetingId: number) =>
    request<AssignmentResult>(`/assignment/${meetingId}/assign`, {
      method: 'POST',
    }),
  get: (meetingId: number) => request<AssignmentView>(`/assignment/${meetingId}`),
  manual: (meetingId: number, assignments: Assignment[]) =>
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
  sendTestEmail: (to: string) =>
    request<{ success: true; message: string }>('/admin/test-email', {
      method: 'POST',
      body: JSON.stringify({ to }),
    }),
};

// Public
export const publicApi = {
  activeMeetings: () => request<PublicMeeting[]>('/public/meetings/active'),
  register: (
    meetingId: number,
    data: { name: string; email: string; hostWish: HostWish; diet?: string }
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
  create: (data: { type: FeatureRequestType; title: string; description: string }) =>
    request<FeatureRequest>('/feature-requests', { method: 'POST', body: JSON.stringify(data) }),
  list: (filters?: { status?: FeatureRequestStatus; type?: FeatureRequestType }) =>
    request<FeatureRequest[]>(
      `/feature-requests${filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : ''}`
    ),
  my: () => request<FeatureRequest[]>('/feature-requests/my'),
  update: (id: number, data: { status?: FeatureRequestStatus; priority?: FeatureRequestPriority }) =>
    request<FeatureRequest>(`/feature-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/feature-requests/${id}`, { method: 'DELETE' }),
};
