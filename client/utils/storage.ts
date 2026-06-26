import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ChatMessage,
  SmallGroup,
  AppSettings,
  NotificationSettings,
  DiscoveredServer,
} from './types';
import { STORAGE_KEYS } from './types';

// Avatar colors for user identification
const AVATAR_COLORS = [
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

// ─── Device Identity ───

export async function getDeviceId(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
}

export async function saveDeviceId(deviceId: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
}

export async function getDeviceSecret(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.DEVICE_SECRET);
}

export async function saveDeviceSecret(secret: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_SECRET, secret);
}

// ─── App Settings ───

const DEFAULT_SETTINGS: AppSettings = {
  nickname: '',
  theme: 'system',
  disguiseMode: 'none',
  notifications: {
    soundEnabled: true,
    vibrationEnabled: true,
    localNotificationEnabled: true,
    bannerEnabled: true,
  },
};

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!raw) return DEFAULT_SETTINGS;
  const settings = JSON.parse(raw) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(settings.notifications || {}),
    },
  };
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const settings = await getSettings();
  return settings.notifications;
}

export async function saveNotificationSettings(
  notifications: Partial<NotificationSettings>
): Promise<void> {
  const settings = await getSettings();
  const updated = {
    ...settings,
    notifications: { ...settings.notifications, ...notifications },
  };
  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
}

// ─── Messages (per server) ───

export async function getMessages(serverId: string): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGES(serverId));
  if (!raw) return [];
  return JSON.parse(raw) as ChatMessage[];
}

export async function saveMessages(
  serverId: string,
  messages: ChatMessage[]
): Promise<void> {
  // Keep only last 1000 messages to avoid storage issues
  const trimmed = messages.slice(-1000);
  await AsyncStorage.setItem(
    STORAGE_KEYS.MESSAGES(serverId),
    JSON.stringify(trimmed)
  );
}

export async function addMessage(
  serverId: string,
  message: ChatMessage
): Promise<void> {
  const messages = await getMessages(serverId);
  messages.push(message);
  await saveMessages(serverId, messages);
}

// ─── Small Groups (per server) ───

export async function getGroups(serverId: string): Promise<SmallGroup[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS(serverId));
  if (!raw) return [];
  return JSON.parse(raw) as SmallGroup[];
}

export async function saveGroups(
  serverId: string,
  groups: SmallGroup[]
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.GROUPS(serverId),
    JSON.stringify(groups)
  );
}

export async function addGroup(
  serverId: string,
  group: SmallGroup
): Promise<void> {
  const groups = await getGroups(serverId);
  groups.push(group);
  await saveGroups(serverId, groups);
}

export async function removeGroup(
  serverId: string,
  groupId: string
): Promise<void> {
  const groups = await getGroups(serverId);
  const filtered = groups.filter((g) => g.id !== groupId);
  await saveGroups(serverId, filtered);
}

// ─── Blocklist (per user) ───

export async function getBlocklist(myDeviceId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.BLOCKLIST(myDeviceId));
  if (!raw) return [];
  return JSON.parse(raw) as string[];
}

export async function addToBlocklist(
  myDeviceId: string,
  blockedDeviceId: string
): Promise<void> {
  const blocklist = await getBlocklist(myDeviceId);
  if (!blocklist.includes(blockedDeviceId)) {
    blocklist.push(blockedDeviceId);
    await AsyncStorage.setItem(
      STORAGE_KEYS.BLOCKLIST(myDeviceId),
      JSON.stringify(blocklist)
    );
  }
}

export async function removeFromBlocklist(
  myDeviceId: string,
  blockedDeviceId: string
): Promise<void> {
  const blocklist = await getBlocklist(myDeviceId);
  const filtered = blocklist.filter((id) => id !== blockedDeviceId);
  await AsyncStorage.setItem(
    STORAGE_KEYS.BLOCKLIST(myDeviceId),
    JSON.stringify(filtered)
  );
}

// ─── Server History ───

export async function getServerHistory(): Promise<DiscoveredServer[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_HISTORY);
  if (!raw) return [];
  return JSON.parse(raw) as DiscoveredServer[];
}

export async function addToServerHistory(
  server: DiscoveredServer
): Promise<void> {
  const history = await getServerHistory();
  const idx = history.findIndex((s) => s.serverId === server.serverId);
  if (idx >= 0) {
    history[idx] = { ...server, timestamp: Date.now() };
  } else {
    history.unshift(server);
  }
  // Keep only last 10 servers
  await AsyncStorage.setItem(
    STORAGE_KEYS.SERVER_HISTORY,
    JSON.stringify(history.slice(0, 10))
  );
}

// ─── Helpers ───

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekDays[date.getDay()];
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 根据用户 ID 获取头像颜色
 */
export function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
