/**
 * Server Discovery Hook
 *
 * Uses UDP broadcast to discover OfflineChat servers on the local network.
 * Since React Native doesn't have direct UDP access, this implementation
 * uses a polling approach via HTTP requests to known server addresses.
 *
 * For a real UDP implementation, you would need a native module.
 * This implementation provides a fallback using HTTP discovery.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DiscoveredServer } from '@/utils/types';

const DISCOVERY_PORT = 3001;
const DISCOVERY_TIMEOUT = 5000;
const DISCOVERY_INTERVAL = 3000;

interface UseServerDiscoveryOptions {
  enabled: boolean;
  knownServers?: string[]; // Known server IPs to check
}

interface UseServerDiscoveryReturn {
  servers: DiscoveredServer[];
  scanning: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Discover servers on the local network
 * This is a simplified implementation that checks known server addresses
 * In production, you would use UDP broadcast via a native module
 */
export function useServerDiscovery(
  options: UseServerDiscoveryOptions
): UseServerDiscoveryReturn {
  const { enabled, knownServers = [] } = options;
  const [servers, setServers] = useState<DiscoveredServer[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Generate potential IP addresses to scan
  const generatePotentialIPs = useCallback((): string[] => {
    const ips: string[] = [...knownServers];

    // Common local network patterns
    const patterns = [
      '192.168.1.',
      '192.168.0.',
      '192.168.2.',
      '10.0.0.',
      '10.0.1.',
      '172.16.0.',
    ];

    // Add common ports for each pattern
    for (const pattern of patterns) {
      for (let i = 1; i <= 20; i++) {
        ips.push(`${pattern}${i}`);
      }
    }

    return ips;
  }, [knownServers]);

  // Check if a server is available at the given IP
  const checkServer = useCallback(
    async (ip: string): Promise<DiscoveredServer | null> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT);

        const response = await fetch(`http://${ip}:${DISCOVERY_PORT}/api/v1/discover`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const data = await response.json();

        return {
          serverId: data.serverId,
          serverName: data.serverName,
          ip,
          port: DISCOVERY_PORT,
          hasPassword: data.hasPassword,
          requireApproval: data.requireApproval,
          userCount: data.userCount,
          timestamp: Date.now(),
          signalStrength: 4, // Assume full signal for HTTP discovery
        };
      } catch {
        return null;
      }
    },
    []
  );

  // Scan for servers
  const scan = useCallback(async () => {
    if (!enabled) return;

    setScanning(true);
    setError(null);

    const potentialIPs = generatePotentialIPs();
    const discoveredServers: DiscoveredServer[] = [];

    // Check all potential IPs in parallel
    const results = await Promise.allSettled(
      potentialIPs.map((ip) => checkServer(ip))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        discoveredServers.push(result.value);
      }
    }

    if (isMountedRef.current) {
      setServers(discoveredServers);
      setScanning(false);
    }
  }, [enabled, generatePotentialIPs, checkServer]);

  // Manual refresh
  const refresh = useCallback(() => {
    scan();
  }, [scan]);

  // Auto-scan on interval
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      // Initial scan - use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          scan();
        }
      }, 0);

      // Periodic scan
      intervalRef.current = setInterval(scan, DISCOVERY_INTERVAL);

      return () => {
        clearTimeout(timeoutId);
      };
    }

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, scan]);

  return {
    servers,
    scanning,
    error,
    refresh,
  };
}

// ─── Manual Connection Helper ───

export async function connectToServer(
  ip: string,
  port: number = DISCOVERY_PORT
): Promise<DiscoveredServer | null> {
  try {
    const response = await fetch(`http://${ip}:${port}/api/v1/discover`, {
      method: 'GET',
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      serverId: data.serverId,
      serverName: data.serverName,
      ip,
      port,
      hasPassword: data.hasPassword,
      requireApproval: data.requireApproval,
      userCount: data.userCount,
      timestamp: Date.now(),
      signalStrength: 4,
    };
  } catch {
    return null;
  }
}
