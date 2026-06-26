import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import {
  createRoom,
  getRoomByCode,
  getRoomById,
  getRoomUsers,
  getRoomUserCount,
  addUser,
  removeUser,
  getUser,
  addMessage,
  getMessages,
  broadcastToRoom,
  sendToUser,
} from "./chatManager.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── REST API ───

app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Create a room
app.post('/api/v1/rooms', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: '房间名称不能为空' });
    return;
  }
  const room = createRoom(name.trim());
  res.status(201).json(room);
});

// Get room info by code
app.get('/api/v1/rooms/:code', (req, res) => {
  const room = getRoomByCode(req.params.code.toUpperCase());
  if (!room) {
    res.status(404).json({ error: '房间不存在' });
    return;
  }
  const userCount = getRoomUserCount(room.id);
  res.json({ ...room, userCount });
});

// ─── WebSocket Server ───

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface WsUserState {
  userId: string;
  roomId: string;
}

const wsUserMap = new Map<WebSocket, WsUserState>();

wss.on('connection', (ws: WebSocket) => {
  let currentUserState: WsUserState | null = null;

  ws.on('message', (raw: Buffer) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        // ─── Join Room ───
        case 'join': {
          const { userId, nickname, roomCode } = data;
          if (!userId || !nickname || !roomCode) {
            ws.send(JSON.stringify({ type: 'error', message: '参数不完整' }));
            return;
          }

          const room = getRoomByCode(roomCode.toUpperCase());
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
            return;
          }

          // Add user
          const user = addUser(userId, nickname, ws, room.id);
          currentUserState = { userId, roomId: room.id };
          wsUserMap.set(ws, currentUserState);

          // Send join confirmation with room info
          const users = getRoomUsers(room.id).map((u) => ({
            id: u.id,
            nickname: u.nickname,
          }));

          ws.send(JSON.stringify({
            type: 'joined',
            room: { id: room.id, code: room.code, name: room.name },
            userId: user.id,
            users,
            messages: getMessages(room.id),
          }));

          // Broadcast to others that a new user joined
          const systemMsg = {
            type: 'message',
            message: {
              id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
              roomId: room.id,
              senderId: 'system',
              senderName: '系统',
              text: `${nickname} 加入了聊天室`,
              msgType: 'system',
              timestamp: Date.now(),
            },
          };
          broadcastToRoom(room.id, systemMsg, userId);

          // Notify others about updated user list
          broadcastToRoom(room.id, {
            type: 'users_update',
            users: getRoomUsers(room.id).map((u) => ({
              id: u.id,
              nickname: u.nickname,
            })),
          });
          break;
        }

        // ─── Send Message ───
        case 'send_message': {
          if (!currentUserState) {
            ws.send(JSON.stringify({ type: 'error', message: '请先加入房间' }));
            return;
          }
          const { text, msgType, targetId, targetName } = data;
          if (!text || typeof text !== 'string') return;

          const user = getUser(currentUserState.userId);
          if (!user) return;

          const msg = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
            roomId: currentUserState.roomId,
            senderId: user.id,
            senderName: user.nickname,
            text: text.trim(),
            type: msgType || 'group',
            targetId: targetId || undefined,
            targetName: targetName || undefined,
            timestamp: Date.now(),
          };

          addMessage(msg);

          if (msg.type === 'private' && targetId) {
            // Private message: send to sender + target only
            const payload = { type: 'message', message: msg };
            sendToUser(targetId, payload);
            // Echo back to sender
            if (targetId !== user.id) {
              sendToUser(user.id, payload);
            }
          } else {
            // Group message: broadcast to all in room
            broadcastToRoom(currentUserState.roomId, { type: 'message', message: msg });
          }
          break;
        }

        // ─── Ping (keepalive) ───
        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }

        default:
          break;
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    const state = wsUserMap.get(ws);
    if (state) {
      const user = removeUser(state.userId);
      wsUserMap.delete(ws);

      if (user) {
        // Notify room about user leaving
        const remainingUsers = getRoomUsers(state.roomId);
        if (remainingUsers.length > 0) {
          const systemMsg = {
            type: 'message',
            message: {
              id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
              roomId: state.roomId,
              senderId: 'system',
              senderName: '系统',
              text: `${user.nickname} 离开了聊天室`,
              msgType: 'system',
              timestamp: Date.now(),
            },
          };
          broadcastToRoom(state.roomId, systemMsg);

          broadcastToRoom(state.roomId, {
            type: 'users_update',
            users: remainingUsers.map((u) => ({
              id: u.id,
              nickname: u.nickname,
            })),
          });
        }
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
  console.log(`WebSocket server at ws://localhost:${port}/ws`);
});
