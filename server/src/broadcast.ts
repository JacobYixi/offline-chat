import * as dgram from 'dgram';
import { getConfig } from './chatManager.js';

const BROADCAST_PORT = 41234;
const BROADCAST_INTERVAL = 3000; // Broadcast every 3 seconds
const BROADCAST_ADDRESS = '255.255.255.255';

let broadcastInterval: NodeJS.Timeout | null = null;

interface BroadcastMessage {
  type: 'server_discovery';
  serverId: string;
  serverName: string;
  port: number;
  hasPassword: boolean;
  requireApproval: boolean;
  userCount: number;
  timestamp: number;
}

export function startBroadcasting(port: number, getUserCount: () => number): void {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  
  socket.on('error', (err) => {
    console.error('Broadcast socket error:', err);
  });
  
  socket.bind(() => {
    socket.setBroadcast(true);
  });
  
  broadcastInterval = setInterval(() => {
    const config = getConfig();
    if (!config) return;
    
    const message: BroadcastMessage = {
      type: 'server_discovery',
      serverId: config.serverId,
      serverName: config.serverName,
      port,
      hasPassword: config.password !== null,
      requireApproval: config.requireApproval,
      userCount: getUserCount(),
      timestamp: Date.now(),
    };
    
    const buffer = Buffer.from(JSON.stringify(message));
    socket.send(buffer, 0, buffer.length, BROADCAST_PORT, BROADCAST_ADDRESS, (err) => {
      if (err) {
        // Silently ignore broadcast errors (may happen if no network interface)
      }
    });
  }, BROADCAST_INTERVAL);
  
  console.log(`UDP broadcast started on port ${BROADCAST_PORT}`);
}

export function stopBroadcasting(): void {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
}
