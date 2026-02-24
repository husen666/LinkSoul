export interface User {
  id: string;
  email?: string;
  phone?: string;
  nickname: string;
  avatar?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  bio?: string;
  city?: string;
  province?: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  profile?: UserProfile;
  creditScore?: CreditScore;
  creditLogs?: CreditLog[];
  sentMatches?: MatchWithPartner[];
  receivedMatches?: MatchWithPartner[];
  sentReports?: ReportItem[];
  receivedReports?: ReportItem[];
  _count?: { sentMatches: number; receivedMatches: number; messages: number };
}

export interface UserProfile {
  testCompleted: boolean;
  attachmentType?: string;
  communicationStyle?: string;
  personalityTags?: string;
  aiSummary?: string;
}

export interface CreditScore {
  score: number;
  level?: string;
}

export interface CreditLog {
  id: string;
  actionType: string;
  scoreChange: number;
  createdAt: string;
}

export interface UserBrief {
  id: string;
  nickname: string;
  avatar?: string;
}

export interface Match {
  id: string;
  userAId: string;
  userBId: string;
  score: number;
  matchReason?: string;
  status: string;
  createdAt: string;
  userA: UserBrief;
  userB: UserBrief;
  conversation?: { id: string; _count?: { messages: number } };
  relationship?: { stage: string; progressScore?: number };
}

export interface MatchWithPartner {
  id: string;
  score: number;
  status: string;
  createdAt: string;
  userA?: UserBrief;
  userB?: UserBrief;
}

export interface Conversation {
  id: string;
  matchId: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  match?: {
    userA?: UserBrief;
    userB?: UserBrief;
  };
  _count?: { messages: number };
  messages?: { content: string; createdAt: string }[];
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  type: string;
  aiSuggested: boolean;
  createdAt: string;
  sender?: UserBrief;
}

export interface ReportItem {
  id: string;
  reason: string;
  detail?: string;
  status: string;
  resolution?: string;
  createdAt: string;
  reporter?: UserBrief;
  reported?: UserBrief;
}

export interface SoulSession {
  id: string;
  userId: string;
  topic: string;
  title?: string;
  status: string;
  adminId?: string;
  createdAt: string;
  updatedAt: string;
  user?: UserBrief;
  _count?: { messages: number };
  messages?: { content: string; role: string; createdAt: string }[];
}

export interface SoulMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface OpMessage {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  linkUrl?: string;
  priority: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  target?: string;
  targetId?: string;
  detail?: string;
  ip?: string;
  createdAt: string;
  admin?: UserBrief;
}

export interface AdminUser {
  id: string;
  nickname: string;
  email: string;
  phone?: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SystemInfo {
  version: string;
  database: string;
  userCount: number;
  adminCount: number;
  matchCount: number;
  messageCount: number;
  reportCount: number;
  services: ServiceInfo[];
}

export interface ServiceInfo {
  key?: string;
  name: string;
  url: string;
  status: string;
}

export interface DashboardData {
  overview: {
    totalUsers: number; activeUsers: number; bannedUsers: number;
    totalMatches: number; acceptedMatches: number; pendingMatches: number;
    totalConversations: number; totalMessages: number;
    totalReports: number; pendingReports: number;
    testCompletionRate: number;
  };
  today: { todayUsers: number; todayMatches: number; todayMessages: number };
  recentUsers: User[];
  trendData: { label: string; date: string; users: number; matches: number; messages: number }[];
}

export interface AnalyticsData {
  dailyData: { date: string; label: string; newUsers: number; newMatches: number; newMessages: number; newReports: number }[];
  genderDistribution: { type: string; count: number }[];
  statusDistribution: { type: string; count: number }[];
  matchStatusDistribution: { type: string; count: number }[];
  cityDistribution: { city: string; count: number }[];
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  [key: string]: T[] | number;
}
