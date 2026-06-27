/**
 * 移动端嵌入式服务器
 * 使用 TCP Socket 实现简单的聊天服务器
 */

import TcpSocket from 'react-native-tcp-socket';
import * as Crypto from 'expo-crypto';
import { ChatMessage, ChatUser, ServerConfig, SmallGroup, MessageType } from '../utils/types';

// 生成 UUID
function generateUUID(): string {
  return Crypto.randomUUID();
}

const HOST = '0.0.0.0';
const DEFAULT_PORT = 9091;

// 消息类型
interface ServerMessage {
  type: string;
  payload?: any;
}

// 客户端连接
interface ClientConnection {
  id: string;
  socket: any;
  deviceId: string;
  nickname: string;
  isApproved: boolean;
  joinedAt: number;
}

// 服务器状态
interface ServerState {
  isRunning: boolean;
  port: number;
  serverId: string;
  config: ServerConfig;
  clients: Map<string, ClientConnection>;
  messages: ChatMessage[];
  users: Map<string, ChatUser>;
  groups: Map<string, SmallGroup>;
  blacklist: Set<string>;
  pendingApprovals: Map<string, { deviceId: string; nickname: string; message: string; timestamp: number }>;
  // 记录每个 deviceId 对应的已分配昵称（用于断线重连时恢复）
  deviceNicknames: Map<string, string>;
}

// 全局服务器状态
let server: any = null;
const state: ServerState = {
  isRunning: false,
  port: DEFAULT_PORT,
  serverId: generateUUID(),
  config: {
    serverId: '',
    serverName: '聊天室',
    password: null,
    requireApproval: false,
    approvalExpiryHours: null,
    disguiseMode: 'none',
    sharedKey: '',
    createdAt: Date.now(),
  },
  clients: new Map(),
  messages: [],
  users: new Map(),
  groups: new Map(),
  blacklist: new Set(),
  pendingApprovals: new Map(),
  deviceNicknames: new Map(),
};

// 事件监听器
type EventListener = (event: string, data?: any) => void;
let eventListeners: EventListener[] = [];

/**
 * 添加事件监听器
 */
export function addServerListener(listener: EventListener): () => void {
  eventListeners.push(listener);
  return () => {
    eventListeners = eventListeners.filter(l => l !== listener);
  };
}

/**
 * 触发事件
 */
function emit(event: string, data?: any) {
  eventListeners.forEach(listener => listener(event, data));
}

/**
 * 广播消息给所有连接的客户端
 */
function broadcast(message: ServerMessage, excludeId?: string) {
  const data = JSON.stringify(message) + '\n';
  state.clients.forEach((client, id) => {
    if (id !== excludeId && client.isApproved) {
      try {
        client.socket.write(data);
      } catch (error) {
        console.error('Failed to send to client:', id, error);
      }
    }
  });
}

/**
 * 发送消息给指定客户端
 */
function sendToClient(clientId: string, message: ServerMessage) {
  const client = state.clients.get(clientId);
  if (client) {
    try {
      client.socket.write(JSON.stringify(message) + '\n');
    } catch (error) {
      console.error('Failed to send to client:', clientId, error);
    }
  }
}

/**
 * 处理客户端消息
 */
function handleClientMessage(clientId: string, data: string) {
  const client = state.clients.get(clientId);
  if (!client) return;

  try {
    const message: ServerMessage = JSON.parse(data);
    const { type, payload } = message;

    switch (type) {
      case 'auth':
        handleAuth(clientId, payload);
        break;
      case 'chat:public':
        handlePublicMessage(clientId, payload);
        break;
      case 'chat:private':
        handlePrivateMessage(clientId, payload);
        break;
      case 'group:create':
        handleGroupCreate(clientId, payload);
        break;
      case 'group:message':
        handleGroupMessage(clientId, payload);
        break;
      case 'approval:request':
        handleApprovalRequest(clientId, payload);
        break;
      case 'approval:respond':
        handleApprovalRespond(clientId, payload);
        break;
      case 'kick':
        handleKick(clientId, payload);
        break;
      case 'ban':
        handleBan(clientId, payload);
        break;
      case 'config:update':
        handleConfigUpdate(clientId, payload);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  } catch (error) {
    console.error('Failed to parse message:', error);
  }
}

/**
 * 处理认证
 */
function handleAuth(clientId: string, payload: any) {
  const client = state.clients.get(clientId);
  if (!client) return;

  const { deviceId, nickname, password } = payload;

  // 检查黑名单
  if (state.blacklist.has(deviceId)) {
    sendToClient(clientId, { type: 'auth:rejected', payload: { reason: 'banned' } });
    return;
  }

  // 检查密码
  if (state.config.password && password !== state.config.password) {
    sendToClient(clientId, { type: 'auth:rejected', payload: { reason: 'wrong_password' } });
    return;
  }

  // 检查昵称：如果该 deviceId 之前有分配过昵称（断线重连），则恢复原昵称
  // 否则检查是否重名，如果重复则自动加编号
  let finalNickname: string = state.deviceNicknames.get(deviceId) || '';
  
  if (!finalNickname) {
    // 新设备，检查重名
    finalNickname = nickname;
    let suffix = 1;
    const existingUsers = Array.from(state.users.values());
    while (existingUsers.some(u => u.nickname === finalNickname)) {
      suffix++;
      finalNickname = `${nickname}#${suffix}`;
    }
    // 记录分配的昵称
    state.deviceNicknames.set(deviceId, finalNickname);
  }

  // 检查是否需要审批
  if (state.config.requireApproval && !isOwner(clientId)) {
    state.pendingApprovals.set(deviceId, {
      deviceId,
      nickname: finalNickname,
      message: payload.message || '',
      timestamp: Date.now(),
    });
    sendToClient(clientId, { type: 'auth:pending' });
    // 通知房主
    notifyOwner({ type: 'approval:new', payload: { deviceId, nickname: finalNickname, message: payload.message } });
    return;
  }

  // 认证成功
  client.deviceId = deviceId;
  client.nickname = finalNickname;
  client.isApproved = true;
  client.joinedAt = Date.now();

  // 创建用户信息
  const user: ChatUser = {
    id: deviceId,
    nickname: finalNickname,
    isOwner: false,
    isApproved: true,
    pubKey: payload.pubKey || '',
  };
  state.users.set(deviceId, user);

  // 发送成功响应
  sendToClient(clientId, {
    type: 'auth:success',
    payload: {
      serverId: state.serverId,
      serverName: state.config.serverName,
      nickname: finalNickname, // 返回实际使用的昵称（可能带编号）
      users: Array.from(state.users.values()),
      messages: state.messages.slice(-50), // 最近50条消息
    },
  });

  // 广播新用户加入
  broadcast({
    type: 'user:joined',
    payload: { user },
  }, clientId);

  emit('user:joined', user);
}

/**
 * 处理公共消息
 */
function handlePublicMessage(clientId: string, payload: any) {
  const client = state.clients.get(clientId);
  if (!client || !client.isApproved) return;

  const message: ChatMessage = {
    id: generateUUID(),
    type: 'group',
    text: payload.text,
    senderId: client.deviceId,
    senderName: client.nickname,
    timestamp: Date.now(),
    replyTo: payload.replyTo,
    mentions: payload.mentions,
  };

  state.messages.push(message);

  // 广播给所有客户端
  broadcast({ type: 'chat:message', payload: message });
  emit('chat:message', message);
}

/**
 * 处理私聊消息
 */
function handlePrivateMessage(clientId: string, payload: any) {
  const client = state.clients.get(clientId);
  if (!client || !client.isApproved) return;

  const { targetDeviceId, encryptedContent } = payload;

  // 找到目标客户端
  let targetClientId: string | null = null;
  state.clients.forEach((c, id) => {
    if (c.deviceId === targetDeviceId) {
      targetClientId = id;
    }
  });

  if (targetClientId) {
    sendToClient(targetClientId, {
      type: 'chat:private',
      payload: {
        fromDeviceId: client.deviceId,
        fromNickname: client.nickname,
        encryptedContent,
        timestamp: Date.now(),
      },
    });
  }
}

/**
 * 处理创建小群
 */
function handleGroupCreate(clientId: string, payload: any) {
  const client = state.clients.get(clientId);
  if (!client || !client.isApproved) return;

  const group: SmallGroup = {
    id: generateUUID(),
    name: payload.name,
    ownerId: client.deviceId,
    memberIds: [client.deviceId, ...(payload.memberIds || [])],
    groupKey: '',
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  state.groups.set(group.id, group);

  // 通知所有成员
  group.memberIds.forEach((deviceId: string) => {
    state.clients.forEach((c, id) => {
      if (c.deviceId === deviceId) {
        sendToClient(id, { type: 'group:created', payload: group });
      }
    });
  });

  emit('group:created', group);
}

/**
 * 处理小群消息
 */
function handleGroupMessage(clientId: string, payload: any) {
  const client = state.clients.get(clientId);
  if (!client || !client.isApproved) return;

  const group = state.groups.get(payload.groupId);
  if (!group) return;

  // 检查是否是成员
  if (!group.memberIds.includes(client.deviceId)) return;

  // 转发给其他成员
  group.memberIds.forEach((deviceId: string) => {
    if (deviceId !== client.deviceId) {
      state.clients.forEach((c, id) => {
        if (c.deviceId === deviceId) {
          sendToClient(id, {
            type: 'group:message',
            payload: {
              groupId: group.id,
              fromDeviceId: client.deviceId,
              fromNickname: client.nickname,
              encryptedContent: payload.encryptedContent,
              timestamp: Date.now(),
            },
          });
        }
      });
    }
  });
}

/**
 * 处理申请加入
 */
function handleApprovalRequest(clientId: string, payload: any) {
  const client = state.clients.get(clientId);
  if (!client) return;

  state.pendingApprovals.set(payload.deviceId, {
    deviceId: payload.deviceId,
    nickname: payload.nickname,
    message: payload.message || '',
    timestamp: Date.now(),
  });

  // 通知房主
  notifyOwner({
    type: 'approval:new',
    payload: { deviceId: payload.deviceId, nickname: payload.nickname, message: payload.message },
  });
}

/**
 * 处理审批响应
 */
function handleApprovalRespond(clientId: string, payload: any) {
  if (!isOwner(clientId)) return;

  const { deviceId, approved } = payload;
  const pending = state.pendingApprovals.get(deviceId);
  if (!pending) return;

  state.pendingApprovals.delete(deviceId);

  // 找到对应的客户端
  state.clients.forEach((client, id) => {
    if (client.deviceId === deviceId) {
      if (approved) {
        client.isApproved = true;
        client.nickname = pending.nickname;
        client.joinedAt = Date.now();

        const user: ChatUser = {
          id: deviceId,
          nickname: pending.nickname,
          isOwner: false,
          isApproved: true,
          pubKey: '',
        };
        state.users.set(deviceId, user);

        sendToClient(id, {
          type: 'auth:success',
          payload: {
            serverId: state.serverId,
            serverName: state.config.serverName,
            users: Array.from(state.users.values()),
            messages: state.messages.slice(-50),
          },
        });

        broadcast({ type: 'user:joined', payload: { user } }, id);
      } else {
        sendToClient(id, { type: 'auth:rejected', payload: { reason: 'rejected' } });
        client.socket.destroy();
        state.clients.delete(id);
      }
    }
  });

  emit('approval:respond', { deviceId, approved });
}

/**
 * 处理踢人
 */
function handleKick(clientId: string, payload: any) {
  if (!isOwner(clientId)) return;

  const { deviceId } = payload;

  state.clients.forEach((client, id) => {
    if (client.deviceId === deviceId) {
      sendToClient(id, { type: 'kicked' });
      client.socket.destroy();
      state.clients.delete(id);
      state.users.delete(deviceId);
      state.deviceNicknames.delete(deviceId); // 释放昵称，允许新用户使用
      broadcast({ type: 'user:left', payload: { deviceId } });
    }
  });

  emit('user:kicked', { deviceId });
}

/**
 * 处理拉黑
 */
function handleBan(clientId: string, payload: any) {
  if (!isOwner(clientId)) return;

  const { deviceId } = payload;
  state.blacklist.add(deviceId);

  // 踢出用户
  handleKick(clientId, { deviceId });
  emit('user:banned', { deviceId });
}

/**
 * 处理配置更新
 */
function handleConfigUpdate(clientId: string, payload: any) {
  if (!isOwner(clientId)) return;

  state.config = { ...state.config, ...payload };
  emit('config:updated', state.config);
}

/**
 * 检查是否是房主
 */
function isOwner(clientId: string): boolean {
  const client = state.clients.get(clientId);
  return client?.deviceId === getOwnerDeviceId();
}

/**
 * 获取房主设备ID（第一个连接的客户端）
 */
function getOwnerDeviceId(): string {
  // 房主是创建服务器的设备，这里简化处理
  // 实际上房主应该是运行服务器的设备本身
  return 'owner';
}

/**
 * 通知房主
 */
function notifyOwner(message: ServerMessage) {
  // 房主是第一个客户端（创建者）
  const ownerClient = Array.from(state.clients.values()).find(c => c.deviceId === 'owner');
  if (ownerClient) {
    try {
      ownerClient.socket.write(JSON.stringify(message) + '\n');
    } catch (error) {
      console.error('Failed to notify owner:', error);
    }
  }
}

/**
 * 启动服务器
 */
export async function startServer(config: Partial<ServerConfig>): Promise<{ success: boolean; port?: number; error?: string }> {
  if (state.isRunning) {
    return { success: false, error: 'Server already running' };
  }

  try {
    // 更新配置
    state.config = {
      ...state.config,
      ...config,
      serverId: state.serverId,
    };
    state.port = DEFAULT_PORT;

    // 创建 TCP 服务器
    server = TcpSocket.createServer((socket: any) => {
      const clientId = generateUUID();
      
      state.clients.set(clientId, {
        id: clientId,
        socket,
        deviceId: '',
        nickname: '',
        isApproved: false,
        joinedAt: 0,
      });

      console.log('Client connected:', clientId);
      emit('client:connected', { clientId });

      socket.on('data', (data: string) => {
        // 处理可能的多条消息
        const lines = data.split('\n').filter(line => line.trim());
        lines.forEach(line => handleClientMessage(clientId, line));
      });

      socket.on('error', (error: any) => {
        console.error('Socket error:', error);
      });

      socket.on('close', () => {
        const client = state.clients.get(clientId);
        if (client && client.isApproved) {
          state.users.delete(client.deviceId);
          state.deviceNicknames.delete(client.deviceId); // 释放昵称，允许新用户使用
          broadcast({ type: 'user:left', payload: { deviceId: client.deviceId } });
          emit('user:left', { deviceId: client.deviceId });
        }
        state.clients.delete(clientId);
        console.log('Client disconnected:', clientId);
        emit('client:disconnected', { clientId });
      });
    });

    server.on('error', (error: any) => {
      console.error('Server error:', error);
      emit('server:error', { error: error.message });
    });

    server.on('listening', () => {
      state.isRunning = true;
      console.log(`Server started on ${HOST}:${state.port}`);
      emit('server:started', { port: state.port, serverId: state.serverId });
    });

    // 监听端口
    server.listen(state.port, HOST);

    return { success: true, port: state.port };
  } catch (error) {
    console.error('Failed to start server:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 停止服务器
 */
export async function stopServer(): Promise<void> {
  if (!state.isRunning || !server) {
    return;
  }

  return new Promise((resolve) => {
    // 断开所有客户端
    state.clients.forEach((client) => {
      try {
        client.socket.destroy();
      } catch (error) {
        // Ignore
      }
    });
    state.clients.clear();

    // 关闭服务器
    server.close(() => {
      state.isRunning = false;
      server = null;
      console.log('Server stopped');
      emit('server:stopped', {});
      resolve();
    });
  });
}

/**
 * 获取服务器状态
 */
export function getServerState(): { isRunning: boolean; port: number; serverId: string; config: ServerConfig } {
  return {
    isRunning: state.isRunning,
    port: state.port,
    serverId: state.serverId,
    config: state.config,
  };
}

/**
 * 获取在线用户列表
 */
export function getOnlineUsers(): ChatUser[] {
  return Array.from(state.users.values());
}

/**
 * 获取消息历史
 */
export function getMessages(): ChatMessage[] {
  return state.messages;
}

/**
 * 获取待审批列表
 */
export function getPendingApprovals() {
  return Array.from(state.pendingApprovals.values());
}

/**
 * 发送系统消息
 */
export function sendSystemMessage(text: string) {
  const message: ChatMessage = {
    id: generateUUID(),
    type: 'system',
    text,
    senderId: 'system',
    senderName: 'System',
    timestamp: Date.now(),
  };

  state.messages.push(message);
  broadcast({ type: 'chat:message', payload: message });
  emit('chat:message', message);
}
