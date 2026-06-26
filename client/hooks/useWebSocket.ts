import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: Record<string, unknown>) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: unknown) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  send: (data: Record<string, unknown>) => void;
  connected: boolean;
  reconnect: () => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, onMessage, onOpen, onClose, onError, autoReconnect = true, reconnectInterval = 3000 } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const connectRef = useRef<() => void>(/* noop */() => undefined);

  // Keep refs updated in effect (not during render)
  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
  });

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setConnected(true);
        onOpenRef.current?.();
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data as string);
          onMessageRef.current(data);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setConnected(false);
        onCloseRef.current?.();
        if (autoReconnect && isMountedRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) connectRef.current();
          }, reconnectInterval);
        }
      };

      ws.onerror = (event) => {
        if (!isMountedRef.current) return;
        onErrorRef.current?.(event);
      };
    } catch {
      if (autoReconnect && isMountedRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) connectRef.current();
        }, reconnectInterval);
      }
    }
  }, [url, autoReconnect, reconnectInterval]);

  // Keep connectRef in sync via effect
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    connect();
  }, [connect]);

  const disconnect = useCallback(() => {
    isMountedRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();
    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { send, connected, reconnect, disconnect };
}
