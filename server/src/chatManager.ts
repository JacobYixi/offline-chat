import { WebSocket } from 'ws';
import { generateRoomCode } from './utils.js';

// ─── Types ───

export interface ChatUser {
  id: string;
  nickname: string;
  ws: WebSocket;
  roomId: string;
}

export interface ChatRoom {
  id: string;
  code: string;
  name: string;
  disguiseMode: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'group' | 'private' | 'system';
  targetId?: string;
  targetName?: string;
  timestamp: number;
}

// ─── State ───

const rooms = new Map<string, ChatRoom>();
const users = new Map<string, ChatUser>(); // userId -> ChatUser
const roomMessages = new Map<string, ChatMessage[]>(); // roomId -> messages

// ─── Room Management ───

export function createRoom(name: string, disguiseMode: string = 'none'): ChatRoom {
  const id = generateId();
  const code = generateRoomCode();
  const room: ChatRoom = { id, code, name, disguiseMode, createdAt: Date.now() };
  rooms.set(id, room);
  roomMessages.set(id, []);
  return room;
}

export function getRoomByCode(code: string): ChatRoom | undefined {
  for (const room of rooms.values()) {
    if (room.code === code) return room;
  }
  return undefined;
}

export function getRoomById(id: string): ChatRoom | undefined {
  return rooms.get(id);
}

export function getRoomUsers(roomId: string): ChatUser[] {
  const result: ChatUser[] = [];
  for (const user of users.values()) {
    if (user.roomId === roomId) result.push(user);
  }
  return result;
}

export function getRoomUserCount(roomId: string): number {
  let count = 0;
  for (const user of users.values()) {
    if (user.roomId === roomId) count++;
  }
  return count;
}

// ─── User Management ───

export function addUser(userId: string, nickname: string, ws: WebSocket, roomId: string): ChatUser {
  const user: ChatUser = { id: userId, nickname, ws, roomId };
  users.set(userId, user);
  return user;
}

export function removeUser(userId: string): ChatUser | undefined {
  const user = users.get(userId);
  if (user) {
    users.delete(userId);
    // Clean up empty rooms
    const remaining = getRoomUserCount(user.roomId);
    if (remaining === 0) {
      rooms.delete(user.roomId);
      roomMessages.delete(user.roomId);
    }
  }
  return user;
}

export function getUser(userId: string): ChatUser | undefined {
  return users.get(userId);
}

// ─── Message Management ───

export function addMessage(msg: ChatMessage): void {
  const messages = roomMessages.get(msg.roomId) || [];
  messages.push(msg);
  // Keep last 200 messages per room
  if (messages.length > 200) {
    messages.splice(0, messages.length - 200);
  }
  roomMessages.set(msg.roomId, messages);
}

export function getMessages(roomId: string): ChatMessage[] {
  return roomMessages.get(roomId) || [];
}

// ─── Broadcast ───

export function broadcastToRoom(roomId: string, data: object, excludeUserId?: string): void {
  const payload = JSON.stringify(data);
  for (const user of users.values()) {
    if (user.roomId === roomId && user.id !== excludeUserId && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(payload);
    }
  }
}

export function sendToUser(userId: string, data: object): void {
  const user = users.get(userId);
  if (user && user.ws.readyState === WebSocket.OPEN) {
    user.ws.send(JSON.stringify(data));
  }
}

// ─── Helpers ───

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// ─── Cleanup ───

// Clean up rooms older than 24 hours with no users
export function cleanupStaleRooms(): void {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  for (const [id, room] of rooms.entries()) {
    if (now - room.createdAt > maxAge && getRoomUserCount(id) === 0) {
      rooms.delete(id);
      roomMessages.delete(id);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupStaleRooms, 60 * 60 * 1000);
