import { WebSocketServer, WebSocket } from 'ws';

let wss = null;

export function attachWebSocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('connection', (socket) => {
    socket.isAlive = true;
    socket.on('pong', () => (socket.isAlive = true));
    socket.send(JSON.stringify({ type: 'hello', payload: { at: Date.now() } }));
  });
  // Drop dead connections so broadcasts stay fast.
  const interval = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) return socket.terminate();
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(interval));
  return wss;
}

export function broadcast(type, payload) {
  if (!wss) return;
  const msg = JSON.stringify({ type, payload });
  for (const socket of wss.clients) {
    if (socket.readyState === WebSocket.OPEN) socket.send(msg);
  }
}
