import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Chat, Message } from './types';

const CHATS_KEY = '@offline_chat_chats';
const MESSAGES_KEY = '@offline_chat_messages';

// ─── Chats ───

export async function getChats(): Promise<Chat[]> {
  const raw = await AsyncStorage.getItem(CHATS_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Chat[];
}

export async function saveChat(chat: Chat): Promise<void> {
  const chats = await getChats();
  const idx = chats.findIndex((c) => c.id === chat.id);
  if (idx >= 0) {
    chats[idx] = chat;
  } else {
    chats.unshift(chat);
  }
  await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
}

export async function deleteChat(chatId: string): Promise<void> {
  const chats = await getChats();
  const filtered = chats.filter((c) => c.id !== chatId);
  await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(filtered));
  // Also delete messages for this chat
  const messages = await getMessages(chatId);
  void messages; // just to reference
  await AsyncStorage.setItem(
    `${MESSAGES_KEY}_${chatId}`,
    JSON.stringify([])
  );
}

// ─── Messages ───

export async function getMessages(chatId: string): Promise<Message[]> {
  const raw = await AsyncStorage.getItem(`${MESSAGES_KEY}_${chatId}`);
  if (!raw) return [];
  return JSON.parse(raw) as Message[];
}

export async function addMessage(message: Message): Promise<void> {
  const messages = await getMessages(message.chatId);
  messages.push(message);
  await AsyncStorage.setItem(
    `${MESSAGES_KEY}_${message.chatId}`,
    JSON.stringify(messages)
  );
  // Update chat's last message
  const chats = await getChats();
  const idx = chats.findIndex((c) => c.id === message.chatId);
  if (idx >= 0) {
    chats[idx].lastMessage = message.text;
    chats[idx].lastTimestamp = message.timestamp;
    // Move updated chat to top
    const updated = chats.splice(idx, 1);
    chats.unshift(updated[0]);
    await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  }
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

// Avatar colors for chats
export const AVATAR_COLORS = [
  '#6C63FF',
  '#FF6584',
  '#00B894',
  '#FDCB6E',
  '#0984E3',
  '#E17055',
  '#A29BFE',
  '#55EFC4',
  '#FF7675',
  '#74B9FF',
];

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
