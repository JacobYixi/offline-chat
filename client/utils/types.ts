// ─── Server Types ───

export interface ServerConfig {
  serverId: string;
  serverName: string;
  password: string | null;
  requireApproval: boolean;
  approvalExpiryHours: number | null;
  disguiseMode: DisguiseMode;
  sharedKey: string;
  createdAt: number;
}

export interface DiscoveredServer {
  serverId: string;
  serverName: string;
  ip: string;
  port: number;
  hasPassword: boolean;
  requireApproval: boolean;
  userCount: number;
  timestamp: number;
  signalStrength?: number; // 1-4 bars
}

// ─── User Types ───

export interface ChatUser {
  id: string; // deviceId
  nickname: string;
  isOwner: boolean;
  isApproved: boolean;
  pubKey: string;
}

export interface PendingApproval {
  id: string;
  deviceId: string;
  nickname: string;
  reason: string;
  submittedAt: number;
}

export interface BlacklistEntry {
  deviceId: string;
  nickname: string;
  reason: string;
  addedAt: number;
}

// ─── Message Types ───

export type MessageType = 'group' | 'private' | 'system' | 'group_invite';
export type DisguiseMode = 'none' | 'weather' | 'code' | 'syslog' | 'shopping';

export interface ReplyTo {
  messageId: string;
  senderName: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type: MessageType;
  targetId?: string;
  targetName?: string;
  replyTo?: ReplyTo;
  mentions?: string[];
  groupId?: string;
  timestamp: number;
}

// ─── Small Group Types ───

export interface SmallGroup {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  groupKey: string;
  createdAt: number;
  lastActivityAt: number;
}

// ─── Report Types ───

export type ReportResolution = 'warn' | 'kick' | 'ban' | 'ignore';

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedId: string;
  reportedName: string;
  reason: string;
  includeMessages: boolean;
  messages?: Array<{
    messageId: string;
    content: string;
    timestamp: number;
  }>;
  status: 'pending' | 'resolved';
  resolution?: ReportResolution;
  createdAt: number;
  resolvedAt?: number;
}

// ─── WebSocket Message Types ───

export type WsMessageType =
  | 'auth'
  | 'auth_success'
  | 'approval_required'
  | 'submit_approval'
  | 'approval_submitted'
  | 'approval_granted'
  | 'approve_user'
  | 'reject_approval'
  | 'approval_result'
  | 'new_approval'
  | 'send_message'
  | 'message'
  | 'user_joined'
  | 'user_left'
  | 'users_update'
  | 'create_group'
  | 'group_created'
  | 'invite_to_group'
  | 'group_invite'
  | 'group_update'
  | 'leave_group'
  | 'left_group'
  | 'kick_user'
  | 'kicked'
  | 'warning'
  | 'submit_report'
  | 'report_submitted'
  | 'new_report'
  | 'resolve_report'
  | 'report_result'
  | 'report_resolved'
  | 'ping'
  | 'pong'
  | 'error';

export interface WsMessage {
  type: WsMessageType;
  [key: string]: unknown;
}

// ─── Notification Settings ───

export interface NotificationSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  localNotificationEnabled: boolean;
  bannerEnabled: boolean;
}

// ─── App Settings ───

export interface AppSettings {
  nickname: string;
  theme: 'dark' | 'light' | 'system';
  disguiseMode: DisguiseMode;
  notifications: NotificationSettings;
}

// ─── Storage Keys ───

export const STORAGE_KEYS = {
  DEVICE_ID: '@offlinechat:deviceId',
  DEVICE_SECRET: '@offlinechat:deviceSecret',
  SETTINGS: '@offlinechat:settings',
  MESSAGES: (serverId: string) => `@offlinechat:messages:${serverId}`,
  GROUPS: (serverId: string) => `@offlinechat:groups:${serverId}`,
  BLOCKLIST: (deviceId: string) => `@offlinechat:blocklist:${deviceId}`,
  SERVER_HISTORY: '@offlinechat:serverHistory',
} as const;
