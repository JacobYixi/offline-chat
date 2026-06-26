import { WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Types ───

export interface ServerConfig {
  serverId: string;
  serverName: string;
  password: string | null; // null = no password required
  requireApproval: boolean;
  approvalExpiryHours: number | null; // null = no expiry
  disguiseMode: 'none' | 'weather' | 'code' | 'syslog' | 'shopping';
  sharedKey: string; // For public message encryption
  createdAt: number;
}

export interface ChatUser {
  id: string; // deviceId
  nickname: string;
  ws: WebSocket | null; // null if not connected
  isOwner: boolean;
  isApproved: boolean;
  approvedAt: number | null;
  pubKey: string; // ECDH public key for private messages
  joinedAt: number;
}

export interface PendingApproval {
  id: string;
  deviceId: string;
  nickname: string;
  reason: string;
  pubKey: string;
  submittedAt: number;
}

export interface BlacklistEntry {
  deviceId: string;
  nickname: string;
  reason: string;
  addedAt: number;
  addedBy: string; // deviceId of who added
}

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
  resolution?: 'warn' | 'kick' | 'ban' | 'ignore';
  createdAt: number;
  resolvedAt?: number;
}

export interface SmallGroup {
  id: string;
  name: string;
  ownerId: string; // creator's deviceId
  memberIds: string[];
  groupKey: string; // encrypted group key for messaging
  createdAt: number;
  lastActivityAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'group' | 'private' | 'system' | 'group_invite';
  targetId?: string;
  targetName?: string;
  replyTo?: {
    messageId: string;
    senderName: string;
    content: string;
  };
  mentions?: string[]; // deviceIds of mentioned users
  groupId?: string; // small group ID if message is in a small group
  timestamp: number;
}

// ─── State ───

const CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json');
const DATA_DIR = path.join(process.cwd(), 'data');

let config: ServerConfig | null = null;
const users = new Map<string, ChatUser>(); // deviceId -> ChatUser
const pendingApprovals = new Map<string, PendingApproval>(); // approvalId -> PendingApproval
const blacklist = new Map<string, BlacklistEntry>(); // deviceId -> BlacklistEntry
const reports = new Map<string, Report>(); // reportId -> Report
const smallGroups = new Map<string, SmallGroup>(); // groupId -> SmallGroup
const messages: ChatMessage[] = []; // All messages (max 500)

// ─── Config Management ───

export function loadConfig(): ServerConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      config = JSON.parse(data);
      return config;
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return null;
}

export function saveConfig(): void {
  if (!config) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

export function initServer(serverName: string, options: {
  password?: string;
  requireApproval?: boolean;
  approvalExpiryHours?: number | null;
  disguiseMode?: ServerConfig['disguiseMode'];
}): ServerConfig {
  const existingConfig = loadConfig();
  
  if (existingConfig) {
    // Server already initialized, update settings
    config = {
      ...existingConfig,
      serverName: serverName || existingConfig.serverName,
      password: options.password !== undefined ? options.password : existingConfig.password,
      requireApproval: options.requireApproval !== undefined ? options.requireApproval : existingConfig.requireApproval,
      approvalExpiryHours: options.approvalExpiryHours !== undefined ? options.approvalExpiryHours : existingConfig.approvalExpiryHours,
      disguiseMode: options.disguiseMode || existingConfig.disguiseMode,
    };
  } else {
    // First time initialization
    config = {
      serverId: crypto.randomUUID(),
      serverName: serverName || 'OfflineChat Server',
      password: options.password || null,
      requireApproval: options.requireApproval || false,
      approvalExpiryHours: options.approvalExpiryHours ?? null,
      disguiseMode: options.disguiseMode || 'none',
      sharedKey: crypto.randomBytes(32).toString('hex'),
      createdAt: Date.now(),
    };
  }
  
  saveConfig();
  return config;
}

export function getConfig(): ServerConfig | null {
  return config;
}

export function updatePassword(newPassword: string | null): void {
  if (!config) return;
  config.password = newPassword;
  saveConfig();
}

// ─── User Management ───

export function addUser(deviceId: string, nickname: string, ws: WebSocket, pubKey: string, isOwner: boolean = false): ChatUser {
  const user: ChatUser = {
    id: deviceId,
    nickname,
    ws,
    isOwner,
    isApproved: isOwner ? true : !config?.requireApproval,
    approvedAt: isOwner ? Date.now() : (!config?.requireApproval ? Date.now() : null),
    pubKey,
    joinedAt: Date.now(),
  };
  users.set(deviceId, user);
  return user;
}

export function removeUser(deviceId: string): ChatUser | undefined {
  const user = users.get(deviceId);
  if (user) {
    users.delete(deviceId);
  }
  return user;
}

export function getUser(deviceId: string): ChatUser | undefined {
  return users.get(deviceId);
}

export function getAllUsers(): ChatUser[] {
  return Array.from(users.values());
}

export function getOnlineUsers(): ChatUser[] {
  return Array.from(users.values()).filter(u => u.ws && u.ws.readyState === WebSocket.OPEN);
}

export function updateUserWs(deviceId: string, ws: WebSocket): void {
  const user = users.get(deviceId);
  if (user) {
    user.ws = ws;
  }
}

export function approveUser(approvalId: string): PendingApproval | null {
  const approval = pendingApprovals.get(approvalId);
  if (!approval) return null;
  
  const user = users.get(approval.deviceId);
  if (user) {
    user.isApproved = true;
    user.approvedAt = Date.now();
    user.pubKey = approval.pubKey;
  }
  
  pendingApprovals.delete(approvalId);
  return approval;
}

export function rejectApproval(approvalId: string): void {
  pendingApprovals.delete(approvalId);
}

export function addPendingApproval(approval: PendingApproval): void {
  pendingApprovals.set(approval.id, approval);
}

export function getPendingApprovals(): PendingApproval[] {
  return Array.from(pendingApprovals.values());
}

// ─── Blacklist Management ───

export function addToBlacklist(deviceId: string, nickname: string, reason: string, addedBy: string): void {
  blacklist.set(deviceId, {
    deviceId,
    nickname,
    reason,
    addedAt: Date.now(),
    addedBy,
  });
}

export function removeFromBlacklist(deviceId: string): void {
  blacklist.delete(deviceId);
}

export function isBlacklisted(deviceId: string): boolean {
  return blacklist.has(deviceId);
}

export function getBlacklist(): BlacklistEntry[] {
  return Array.from(blacklist.values());
}

// ─── Report Management ───

export function addReport(report: Report): void {
  reports.set(report.id, report);
}

export function resolveReport(reportId: string, resolution: Report['resolution']): Report | null {
  const report = reports.get(reportId);
  if (!report) return null;
  
  report.status = 'resolved';
  report.resolution = resolution;
  report.resolvedAt = Date.now();
  
  return report;
}

export function getReports(): Report[] {
  return Array.from(reports.values());
}

export function getPendingReports(): Report[] {
  return Array.from(reports.values()).filter(r => r.status === 'pending');
}

// ─── Small Group Management ───

export function createSmallGroup(name: string, ownerId: string, memberIds: string[]): SmallGroup {
  const group: SmallGroup = {
    id: crypto.randomUUID(),
    name,
    ownerId,
    memberIds: [ownerId, ...memberIds],
    groupKey: crypto.randomBytes(32).toString('hex'),
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  smallGroups.set(group.id, group);
  return group;
}

export function getSmallGroup(groupId: string): SmallGroup | undefined {
  return smallGroups.get(groupId);
}

export function getAllSmallGroups(): SmallGroup[] {
  return Array.from(smallGroups.values());
}

export function getUserSmallGroups(deviceId: string): SmallGroup[] {
  return Array.from(smallGroups.values()).filter(g => g.memberIds.includes(deviceId));
}

export function addMemberToGroup(groupId: string, deviceId: string): boolean {
  const group = smallGroups.get(groupId);
  if (!group) return false;
  if (!group.memberIds.includes(deviceId)) {
    group.memberIds.push(deviceId);
  }
  return true;
}

export function removeMemberFromGroup(groupId: string, deviceId: string): boolean {
  const group = smallGroups.get(groupId);
  if (!group) return false;
  group.memberIds = group.memberIds.filter(id => id !== deviceId);
  if (group.memberIds.length === 0) {
    smallGroups.delete(groupId);
  }
  return true;
}

export function transferGroupOwnership(groupId: string, newOwnerId: string): boolean {
  const group = smallGroups.get(groupId);
  if (!group) return false;
  if (!group.memberIds.includes(newOwnerId)) return false;
  group.ownerId = newOwnerId;
  return true;
}

export function deleteSmallGroup(groupId: string): void {
  smallGroups.delete(groupId);
}

// Auto cleanup inactive groups (older than 7 days)
export function cleanupInactiveGroups(): void {
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  for (const [id, group] of smallGroups.entries()) {
    if (now - group.lastActivityAt > maxAge) {
      smallGroups.delete(id);
    }
  }
}

// ─── Message Management ───

export function addMessage(msg: ChatMessage): void {
  messages.push(msg);
  // Keep last 500 messages
  if (messages.length > 500) {
    messages.splice(0, messages.length - 500);
  }
  
  // Update small group activity
  if (msg.groupId) {
    const group = smallGroups.get(msg.groupId);
    if (group) {
      group.lastActivityAt = Date.now();
    }
  }
}

export function getMessages(): ChatMessage[] {
  return [...messages];
}

export function getGroupMessages(groupId: string): ChatMessage[] {
  return messages.filter(m => m.groupId === groupId);
}

// ─── Broadcast ───

export function broadcastToAll(data: object, excludeDeviceId?: string): void {
  const payload = JSON.stringify(data);
  for (const user of users.values()) {
    if (user.ws && user.ws.readyState === WebSocket.OPEN && user.id !== excludeDeviceId) {
      user.ws.send(payload);
    }
  }
}

export function broadcastToApproved(data: object, excludeDeviceId?: string): void {
  const payload = JSON.stringify(data);
  for (const user of users.values()) {
    if (user.ws && user.ws.readyState === WebSocket.OPEN && user.isApproved && user.id !== excludeDeviceId) {
      user.ws.send(payload);
    }
  }
}

export function sendToDevice(deviceId: string, data: object): void {
  const user = users.get(deviceId);
  if (user && user.ws && user.ws.readyState === WebSocket.OPEN) {
    user.ws.send(JSON.stringify(data));
  }
}

export function broadcastToGroup(groupId: string, data: object, excludeDeviceId?: string): void {
  const group = smallGroups.get(groupId);
  if (!group) return;
  
  const payload = JSON.stringify(data);
  for (const memberId of group.memberIds) {
    if (memberId === excludeDeviceId) continue;
    const user = users.get(memberId);
    if (user && user.ws && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(payload);
    }
  }
}

// ─── Challenge-Response for Device Identity ───

const challenges = new Map<string, { challenge: string; createdAt: number }>();

export function generateChallenge(deviceId: string): string {
  const challenge = crypto.randomBytes(32).toString('hex');
  challenges.set(deviceId, { challenge, createdAt: Date.now() });
  
  // Clean up old challenges after 5 minutes
  setTimeout(() => {
    challenges.delete(deviceId);
  }, 5 * 60 * 1000);
  
  return challenge;
}

export function verifyChallenge(deviceId: string, response: string, sharedSecret: string): boolean {
  const challengeData = challenges.get(deviceId);
  if (!challengeData) return false;
  
  // Expected response = HMAC-SHA256(challenge, sharedSecret)
  const expected = crypto.createHmac('sha256', sharedSecret).update(challengeData.challenge).digest('hex');
  
  challenges.delete(deviceId);
  return crypto.timingSafeEqual(Buffer.from(response), Buffer.from(expected));
}

// ─── Helpers ───

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// Run cleanup every hour
setInterval(() => {
  cleanupInactiveGroups();
}, 60 * 60 * 1000);
