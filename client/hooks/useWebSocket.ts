import { useEffect, useRef, useCallback, useState } from 'react';
import type { WsMessage, WsMessageType } from '@/utils/types';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: WsMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: unknown) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
}

interface UseWebSocketReturn {
  send: (data: WsMessage) => void;
  sendRaw: (data: Record<string, unknown>) => void;
  connected: boolean;
  connecting: boolean;
  reconnect: () => void;
  disconnect: () => void;
  reconnectAttempts: number;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    autoReconnect = true,
    reconnectInterval = 1000,
    maxReconnectInterval = 30000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const connectRef = useRef<() => void>(() => undefined);
  const shouldReconnectRef = useRef(autoReconnect);

  // Keep refs updated
  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    shouldReconnectRef.current = autoReconnect;
  }, [autoReconnect]);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) return;

    setConnecting(true);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setConnected(true);
        setConnecting(false);
        setReconnectAttempts(0);
        onOpenRef.current?.();
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data as string) as WsMessage;
          onMessageRef.current(data);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setConnected(false);
        setConnecting(false);
        onCloseRef.current?.();

        // Exponential backoff reconnection
        if (shouldReconnectRef.current && isMountedRef.current) {
          setReconnectAttempts((prev) => {
            const newAttempts = prev + 1;
            const delay = Math.min(
              reconnectInterval * Math.pow(2, newAttempts - 1),
              maxReconnectInterval
            );
            reconnectTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) connectRef.current();
            }, delay);
            return newAttempts;
          });
        }
      };

      ws.onerror = (event) => {
        if (!isMountedRef.current) return;
        onErrorRef.current?.(event);
      };
    } catch {
      setConnecting(false);
      if (shouldReconnectRef.current && isMountedRef.current) {
        setReconnectAttempts((prev) => {
          const newAttempts = prev + 1;
          const delay = Math.min(
            reconnectInterval * Math.pow(2, newAttempts - 1),
            maxReconnectInterval
          );
          reconnectTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) connectRef.current();
          }, delay);
          return newAttempts;
        });
      }
    }
  }, [url, reconnectInterval, maxReconnectInterval]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const send = useCallback((data: WsMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendRaw = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setReconnectAttempts(0);
    connectRef.current();
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setConnecting(false);
    setReconnectAttempts(0);
  }, []);

  // Initial connection
  useEffect(() => {
    connectRef.current();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    send,
    sendRaw,
    connected,
    connecting,
    reconnect,
    disconnect,
    reconnectAttempts,
  };
}

// ─── Message Type Helper ───

export function createWsMessage(
  type: WsMessageType,
  data: Record<string, unknown> = {}
): WsMessage {
  return { type, ...data };
}
