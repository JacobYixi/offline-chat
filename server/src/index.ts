import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as chatManager from "./chatManager.js";
import { startBroadcasting } from "./broadcast.js";

const app = express();
const port = parseInt(process.env.PORT || '9091', 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── REST API ───

app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Initialize server (called by the host/owner)
app.post('/api/v1/server/init', (req, res) => {
  const { serverName, password, requireApproval, approvalExpiryHours, disguiseMode } = req.body;
  
  const config = chatManager.initServer(serverName, {
    password: password || null,
    requireApproval: requireApproval || false,
    approvalExpiryHours: approvalExpiryHours ?? null,
    disguiseMode: disguiseMode || 'none',
  });
  
  res.status(200).json(config);
});

// Get server info
app.get('/api/v1/server/info', (_req, res) => {
  const config = chatManager.getConfig();
  if (!config) {
    res.status(404).json({ error: 'Server not initialized' });
    return;
  }
  res.json({
    ...config,
    hasPassword: config.password !== null,
    onlineUsers: chatManager.getOnlineUsers().length,
  });
});

// Update password (owner only)
app.post('/api/v1/server/password', (req, res) => {
  const { deviceId, newPassword } = req.body;
  const user = chatManager.getUser(deviceId);
  
  if (!user || !user.isOwner) {
    res.status(403).json({ error: 'Only owner can change password' });
    return;
  }
  
  chatManager.updatePassword(newPassword || null);
  res.json({ success: true });
});

// Get blacklist (owner only)
app.get('/api/v1/blacklist', (req, res) => {
  const { deviceId } = req.query;
  const user = chatManager.getUser(deviceId as string);
  
  if (!user || !user.isOwner) {
    res.status(403).json({ error: 'Only owner can view blacklist' });
    return;
  }
  
  res.json(chatManager.getBlacklist());
});

// Get reports (owner only)
app.get('/api/v1/reports', (req, res) => {
  const { deviceId } = req.query;
  const user = chatManager.getUser(deviceId as string);
  
  if (!user || !user.isOwner) {
    res.status(403).json({ error: 'Only owner can view reports' });
    return;
  }
  
  res.json(chatManager.getReports());
});

// ─── WebSocket Server ───

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface WsUserState {
  deviceId: string;
  authenticated: boolean;
}

const wsUserMap = new Map<WebSocket, WsUserState>();

wss.on('connection', (ws: WebSocket) => {
  let currentUserState: WsUserState | null = null;
  
  ws.on('message', (raw: Buffer) => {
    try {
      const data = JSON.parse(raw.toString());
      
      switch (data.type) {
        // ─── Authentication ───
        case 'auth': {
          const { deviceId, nickname, pubKey, isOwner, password, challengeResponse } = data;
          
          if (!deviceId || !nickname) {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing deviceId or nickname' }));
            return;
          }
          
          const config = chatManager.getConfig();
          if (!config) {
            ws.send(JSON.stringify({ type: 'error', message: 'Server not initialized' }));
            return;
          }
          
          // Check blacklist
          if (chatManager.isBlacklisted(deviceId)) {
            ws.send(JSON.stringify({ type: 'error', message: 'You are blacklisted from this server' }));
            return;
          }
          
          // Owner authentication
          if (isOwner) {
            const user = chatManager.addUser(deviceId, nickname, ws, pubKey, true);
            currentUserState = { deviceId, authenticated: true };
            wsUserMap.set(ws, currentUserState);
            
            ws.send(JSON.stringify({
              type: 'auth_success',
              isOwner: true,
              server: config,
              users: chatManager.getAllUsers().map(u => ({
                id: u.id,
                nickname: u.nickname,
                isOwner: u.isOwner,
                isApproved: u.isApproved,
                pubKey: u.pubKey,
              })),
              messages: chatManager.getMessages(),
              groups: chatManager.getAllSmallGroups(),
            }));
            
            // Broadcast user joined
            chatManager.broadcastToApproved({
              type: 'user_joined',
              user: { id: user.id, nickname: user.nickname, isOwner: user.isOwner },
            }, deviceId);
            return;
          }
          
          // Password verification
          if (config.password) {
            if (password !== config.password) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid password' }));
              return;
            }
          }
          
          // Check if user needs approval
          const existingUser = chatManager.getUser(deviceId);
          if (config.requireApproval && (!existingUser || !existingUser.isApproved)) {
            // Need to submit approval request
            ws.send(JSON.stringify({
              type: 'approval_required',
              message: 'This server requires approval to join',
            }));
            return;
          }
          
          // Challenge-response for device identity (if user exists)
          if (existingUser && challengeResponse) {
            // TODO: Implement full challenge-response verification
            // For now, trust the client
          }
          
          // Add or update user
          const user = chatManager.addUser(deviceId, nickname, ws, pubKey, false);
          currentUserState = { deviceId, authenticated: true };
          wsUserMap.set(ws, currentUserState);
          
          ws.send(JSON.stringify({
            type: 'auth_success',
            isOwner: false,
            server: config,
            users: chatManager.getAllUsers().map(u => ({
              id: u.id,
              nickname: u.nickname,
              isOwner: u.isOwner,
              isApproved: u.isApproved,
              pubKey: u.pubKey,
            })),
            messages: chatManager.getMessages(),
            groups: chatManager.getUserSmallGroups(deviceId),
          }));
          
          // Broadcast user joined
          chatManager.broadcastToApproved({
            type: 'user_joined',
            user: { id: user.id, nickname: user.nickname, isOwner: user.isOwner },
          }, deviceId);
          break;
        }
        
        // ─── Submit Approval Request ───
        case 'submit_approval': {
          const { deviceId, nickname, reason, pubKey } = data;
          
          if (!deviceId || !nickname || !reason) {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing required fields' }));
            return;
          }
          
          const approval = {
            id: chatManager.generateId(),
            deviceId,
            nickname,
            reason,
            pubKey: pubKey || '',
            submittedAt: Date.now(),
          };
          
          chatManager.addPendingApproval(approval);
          
          // Notify owner
          const owner = chatManager.getAllUsers().find(u => u.isOwner);
          if (owner) {
            chatManager.sendToDevice(owner.id, {
              type: 'new_approval',
              approval,
            });
          }
          
          ws.send(JSON.stringify({
            type: 'approval_submitted',
            message: 'Your approval request has been submitted',
          }));
          break;
        }
        
        // ─── Approve User (Owner only) ───
        case 'approve_user': {
          if (!currentUserState) return;
          const user = chatManager.getUser(currentUserState.deviceId);
          if (!user || !user.isOwner) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only owner can approve users' }));
            return;
          }
          
          const { approvalId } = data;
          const approval = chatManager.approveUser(approvalId);
          
          if (approval) {
            // Notify the approved user
            chatManager.sendToDevice(approval.deviceId, {
              type: 'approval_granted',
              message: 'Your request has been approved',
            });
            
            // Notify owner of success
            ws.send(JSON.stringify({
              type: 'approval_result',
              success: true,
              approvalId,
            }));
            
            // Broadcast updated user list
            chatManager.broadcastToApproved({
              type: 'users_update',
              users: chatManager.getAllUsers().map(u => ({
                id: u.id,
                nickname: u.nickname,
                isOwner: u.isOwner,
                isApproved: u.isApproved,
              })),
            });
          }
          break;
        }
        
        // ─── Reject Approval (Owner only) ───
        case 'reject_approval': {
          if (!currentUserState) return;
          const user = chatManager.getUser(currentUserState.deviceId);
          if (!user || !user.isOwner) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only owner can reject approvals' }));
            return;
          }
          
          const { approvalId } = data;
          chatManager.rejectApproval(approvalId);
          
          ws.send(JSON.stringify({
            type: 'approval_result',
            success: true,
            approvalId,
          }));
          break;
        }
        
        // ─── Send Message ───
        case 'send_message': {
          if (!currentUserState) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }
          
          const sender = chatManager.getUser(currentUserState.deviceId);
          if (!sender || !sender.isApproved) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not approved' }));
            return;
          }
          
          const { text, msgType, targetId, targetName, replyTo, mentions, groupId } = data;
          if (!text || typeof text !== 'string') return;
          
          const msg: chatManager.ChatMessage = {
            id: chatManager.generateId(),
            senderId: sender.id,
            senderName: sender.nickname,
            text: text.trim(),
            type: msgType || 'group',
            targetId: targetId || undefined,
            targetName: targetName || undefined,
            replyTo: replyTo || undefined,
            mentions: mentions || undefined,
            groupId: groupId || undefined,
            timestamp: Date.now(),
          };
          
          chatManager.addMessage(msg);
          
          if (msg.type === 'private' && targetId) {
            // Private message: send to sender + target only
            chatManager.sendToDevice(targetId, { type: 'message', message: msg });
            if (targetId !== sender.id) {
              chatManager.sendToDevice(sender.id, { type: 'message', message: msg });
            }
          } else if (msg.groupId) {
            // Small group message
            chatManager.broadcastToGroup(msg.groupId, { type: 'message', message: msg });
          } else {
            // Group message: broadcast to all approved users
            chatManager.broadcastToApproved({ type: 'message', message: msg });
          }
          break;
        }
        
        // ─── Create Small Group ───
        case 'create_group': {
          if (!currentUserState) return;
          const user = chatManager.getUser(currentUserState.deviceId);
          if (!user || !user.isApproved) return;
          
          const { name, memberIds } = data;
          const group = chatManager.createSmallGroup(name, user.id, memberIds || []);
          
          // Notify all members
          for (const memberId of group.memberIds) {
            chatManager.sendToDevice(memberId, {
              type: 'group_created',
              group,
            });
          }
          break;
        }
        
        // ─── Invite to Small Group ───
        case 'invite_to_group': {
          if (!currentUserState) return;
          const user = chatManager.getUser(currentUserState.deviceId);
          if (!user) return;
          
          const { groupId, deviceId: inviteeId } = data;
          const group = chatManager.getSmallGroup(groupId);
          
          if (!group || group.ownerId !== user.id) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only group owner can invite' }));
            return;
          }
          
          chatManager.addMemberToGroup(groupId, inviteeId);
          
          // Notify the invitee
          chatManager.sendToDevice(inviteeId, {
            type: 'group_invite',
            group: chatManager.getSmallGroup(groupId),
          });
          
          // Notify all members
          chatManager.broadcastToGroup(groupId, {
            type: 'group_update',
            group: chatManager.getSmallGroup(groupId),
          });
          break;
        }
        
        // ─── Leave Small Group ───
        case 'leave_group': {
          if (!currentUserState) return;
          const { groupId } = data;
          
          chatManager.removeMemberFromGroup(groupId, currentUserState.deviceId);
          
          // Notify remaining members
          chatManager.broadcastToGroup(groupId, {
            type: 'group_update',
            group: chatManager.getSmallGroup(groupId),
          });
          
          ws.send(JSON.stringify({
            type: 'left_group',
            groupId,
          }));
          break;
        }
        
        // ─── Kick User (Owner only) ───
        case 'kick_user': {
          if (!currentUserState) return;
          const user = chatManager.getUser(currentUserState.deviceId);
          if (!user || !user.isOwner) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only owner can kick users' }));
            return;
          }
          
          const { targetId, addToBlacklist: shouldBlacklist, reason } = data;
          const target = chatManager.getUser(targetId);
          
          if (!target || target.isOwner) {
            ws.send(JSON.stringify({ type: 'error', message: 'Cannot kick owner' }));
            return;
          }
          
          // Notify the kicked user
          chatManager.sendToDevice(targetId, {
            type: 'kicked',
            reason: reason || 'You have been kicked from the server',
          });
          
          // Remove user
          chatManager.removeUser(targetId);
          
          // Optionally add to blacklist
          if (shouldBlacklist) {
            chatManager.addToBlacklist(targetId, target.nickname, reason || '', user.id);
          }
          
          // Broadcast updated user list
          chatManager.broadcastToApproved({
            type: 'users_update',
            users: chatManager.getAllUsers().map(u => ({
              id: u.id,
              nickname: u.nickname,
              isOwner: u.isOwner,
              isApproved: u.isApproved,
            })),
          });
          
          // Broadcast system message
          chatManager.addMessage({
            id: chatManager.generateId(),
            senderId: 'system',
            senderName: '系统',
            text: `${target.nickname} 被移出了聊天室`,
            type: 'system',
            timestamp: Date.now(),
          });
          
          chatManager.broadcastToApproved({
            type: 'message',
            message: {
              id: chatManager.generateId(),
              senderId: 'system',
              senderName: '系统',
              text: `${target.nickname} 被移出了聊天室`,
              type: 'system',
              timestamp: Date.now(),
            },
          });
          break;
        }
        
        // ─── Submit Report ───
        case 'submit_report': {
          if (!currentUserState) return;
          const reporter = chatManager.getUser(currentUserState.deviceId);
          if (!reporter) return;
          
          const { reportedId, reportedName, reason, includeMessages, messages: reportedMessages } = data;
          
          const report: chatManager.Report = {
            id: chatManager.generateId(),
            reporterId: reporter.id,
            reporterName: reporter.nickname,
            reportedId,
            reportedName,
            reason,
            includeMessages: includeMessages || false,
            messages: reportedMessages || undefined,
            status: 'pending',
            createdAt: Date.now(),
          };
          
          chatManager.addReport(report);
          
          // Notify owner
          const owner = chatManager.getAllUsers().find(u => u.isOwner);
          if (owner) {
            chatManager.sendToDevice(owner.id, {
              type: 'new_report',
              report,
            });
          }
          
          ws.send(JSON.stringify({
            type: 'report_submitted',
            message: 'Your report has been submitted',
          }));
          break;
        }
        
        // ─── Resolve Report (Owner only) ───
        case 'resolve_report': {
          if (!currentUserState) return;
          const user = chatManager.getUser(currentUserState.deviceId);
          if (!user || !user.isOwner) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only owner can resolve reports' }));
            return;
          }
          
          const { reportId, resolution } = data;
          const report = chatManager.resolveReport(reportId, resolution);
          
          if (report) {
            // Notify reporter
            chatManager.sendToDevice(report.reporterId, {
              type: 'report_resolved',
              reportId,
              resolution,
            });
            
            // If resolution is kick or ban, take action
            if (resolution === 'kick' || resolution === 'ban') {
              const target = chatManager.getUser(report.reportedId);
              if (target && !target.isOwner) {
                chatManager.sendToDevice(report.reportedId, {
                  type: 'kicked',
                  reason: `You have been ${resolution === 'ban' ? 'banned' : 'kicked'} due to a report`,
                });
                chatManager.removeUser(report.reportedId);
                
                if (resolution === 'ban') {
                  chatManager.addToBlacklist(report.reportedId, report.reportedName, 'Banned due to report', user.id);
                }
              }
            } else if (resolution === 'warn') {
              chatManager.sendToDevice(report.reportedId, {
                type: 'warning',
                message: 'You have been warned by the server owner',
              });
            }
          }
          
          ws.send(JSON.stringify({
            type: 'report_result',
            success: true,
            reportId,
          }));
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
      const user = chatManager.getUser(state.deviceId);
      wsUserMap.delete(ws);
      
      if (user) {
        // Update user's ws to null (they're offline but still in the room)
        chatManager.updateUserWs(state.deviceId, null as unknown as WebSocket);
        
        // Broadcast user left (but keep them in the user list for reconnection)
        chatManager.broadcastToApproved({
          type: 'user_left',
          deviceId: state.deviceId,
        }, state.deviceId);
      }
    }
  });
  
  ws.on('error', () => {
    wsUserMap.delete(ws);
  });
});

// ─── Start Server ───

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  
  // Initialize server if not already initialized
  if (!chatManager.getConfig()) {
    chatManager.initServer('OfflineChat Server', {});
  }
  
  // Start UDP broadcast
  startBroadcasting(port, () => chatManager.getOnlineUsers().length);
});
