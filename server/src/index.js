import express from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { api } from './api.js';
import { attachWebSocket } from './ws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/v1', api);

// Serve the built frontend from the same server so devices only need one URL.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|ws).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (req, res) =>
    res
      .status(503)
      .send('Family Hub frontend not built yet. Run "npm run build" in the project root, then restart the server.')
  );
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const server = http.createServer(app);
attachWebSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nFamily Hub is running.\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  Network: http://${iface.address}:${PORT}   <- use this URL on the iPad / phones`);
      }
    }
  }
  console.log('');
});
