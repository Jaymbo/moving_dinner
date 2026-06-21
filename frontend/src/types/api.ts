/**
 * Shared API types for the Moving Dinner frontend.
 *
 * These types mirror the backend's JSON responses. Keeping them in one place
 * makes the API client and page components type-safe and easier to maintain.
 */

export type HostWish = 'will_host' | 'indifferent' | 'cannot_host';

export type GroupRole = 'admin' | 'member';

export type MeetingCreationPolicy = 'admin' | 'all';

export type FeatureRequestType = 'bug' | 'feature';

export type FeatureRequestStatus = 'open' | 'in_progress' | 'done' | 'rejected';

export type FeatureRequestPriority = 'low' | 'medium' | 'high';

export interface User {
  id: number;
  name: string;
  email: string;
  address: string | null;
  maxGuests: number;
  notes: string | null;
  diet: string | null;
  isGuest: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  isGuest: boolean;
  isSuperAdmin: boolean;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  inviteCode: string;
  meetingCreation: MeetingCreationPolicy;
  createdBy: number | null;
  createdAt: string;
}

export interface GroupWithRole extends Group {
  role: GroupRole;
}

export interface GroupWithCounts extends GroupWithRole {
  _count: {
    members: number;
    meetings: number;
  };
}

export interface GroupMember {
  id: number;
  groupId: number;
  userId: number;
  role: GroupRole;
  joinedAt: string;
  user: PublicUser;
}

export interface GroupInvitation {
  id: number;
  groupId: number;
  code: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface Meeting {
  id: number;
  groupId: number;
  date: string;
  deadline: string;
  frozen: boolean;
  createdBy: number | null;
  createdAt: string;
}

export interface MeetingGroupInfo {
  id: number;
  name: string;
  meetingCreation: MeetingCreationPolicy;
}

export interface MeetingWithGroup extends Meeting {
  group: MeetingGroupInfo;
}

export interface MeetingWithCounts extends MeetingWithGroup {
  _count: {
    responses: number;
    rsvpTokens: number;
  };
  userRole: GroupRole;
}

export interface MyMeeting extends MeetingWithGroup {
  responses: Pick<Response, 'id' | 'hostWish'>[];
  hasResponded: boolean;
  response: Response | null;
  totalResponses: number;
  userRole: GroupRole;
}

export interface MeetingDetail extends MeetingWithGroup {
  responses: ResponseWithUser[];
  userRole: GroupRole;
}

export interface Response {
  id: number;
  meetingId: number;
  userId: number;
  hostWish: HostWish;
  assignedHost: number | null;
  createdAt: string;
}

export interface ResponseWithUser extends Response {
  user: {
    id: number;
    name: string;
    diet: string | null;
    address: string | null;
    maxGuests: number;
  };
  assignedHostUser: {
    id: number;
    name: string;
    address: string | null;
  } | null;
}

export interface Score {
  id: number;
  userId: number;
  groupId: number;
  participations: number;
  hostings: number;
  hostedGuests: number;
  score: string;
  user: {
    id: number;
    name: string;
    email: string;
    maxGuests: number;
    isGuest: boolean;
    isSuperAdmin: boolean;
  };
}

export interface MatrixEntry {
  id: number;
  userAId: number;
  userBId: number;
  groupId: number;
  count: number;
  userA: { id: number; name: string };
  userB: { id: number; name: string };
}

export interface FeatureRequest {
  id: number;
  userId: number | null;
  groupId: number | null;
  type: FeatureRequestType;
  title: string;
  description: string;
  status: FeatureRequestStatus;
  priority: FeatureRequestPriority;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface AuthResponse {
  id: number;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  token: string;
}

export interface RsvpInfo {
  valid: boolean;
  meetingId?: number;
  userId?: number;
  userName?: string;
  meetingDate?: string;
  deadline?: string;
  reason?: 'already_used' | 'expired' | 'frozen';
}

export interface Assignment {
  userId: number;
  assignedHost: number | null;
}

export interface AssignmentResult {
  success: boolean;
  assignments: ResponseWithUser[];
}

export interface AssignmentView {
  meetingId: number;
  hostGroups: Record<string, { userId: number; name: string }[]>;
  unassigned: { userId: number; name: string }[];
}

export interface JoinLookup {
  type: 'invitation' | 'invite';
  group: {
    id: number;
    name: string;
    description: string | null;
  };
}

export interface PublicMeeting extends Meeting {
  group: {
    id: number;
    name: string;
  };
  _count: {
    responses: number;
  };
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}
