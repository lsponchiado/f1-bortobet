import { useState, useEffect } from 'react';

interface UseLiveConnectionOptions {
  wsUrl: string;
  onEvent: (event: string, data: unknown) => void;
}

export function useLiveConnection({ wsUrl, onEvent }: UseLiveConnectionOptions) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let disposed = false;

    function connect() {
      if (disposed) return;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!disposed) retryTimeout = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          onEvent(msg.event, msg.data);
        } catch { /* malformed message */ }
      };
    }

    connect();
    return () => { disposed = true; ws?.close(); clearTimeout(retryTimeout); };
  }, [wsUrl, onEvent]);

  return connected;
}
