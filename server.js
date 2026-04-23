const fs = require('fs');
const path = require('path');
const express = require('express');
const https = require('https');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const CERT_PATH = process.env.CERT_PATH || 'C:/Users/thx_l/OneDrive/VSC/tattoo_registry_server/192.168.1.93.pem';
const KEY_PATH = process.env.KEY_PATH || 'C:/Users/thx_l/OneDrive/VSC/tattoo_registry_server/192.168.1.93-key.pem';

const app = express();
const options = {
  key: fs.readFileSync(KEY_PATH),
  cert: fs.readFileSync(CERT_PATH),
};
const server = https.createServer(options, app);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 5e7 });

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) return { personnel: [], selectedId: null, updatedAt: new Date().toISOString() };
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (e) {
    console.error('loadStore error', e);
    return { personnel: [], selectedId: null, updatedAt: new Date().toISOString() };
  }
}
function saveStore(payload) {
  const normalized = {
    personnel: Array.isArray(payload.personnel) ? payload.personnel : [],
    selectedId: payload.selectedId || null,
    updatedAt: new Date().toISOString(),
    reason: payload.reason || 'update'
  };
  fs.writeFileSync(STORE_FILE, JSON.stringify(normalized));
  return normalized;
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true, personnelCount: loadStore().personnel.length }));

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
  socket.on('requestState', () => socket.emit('stateSnapshot', loadStore()));
  socket.on('replaceState', (payload = {}) => {
    const saved = saveStore(payload);
    io.emit('stateUpdated', saved);
  });
  socket.on('disconnect', () => console.log('client disconnected', socket.id));
});

server.listen(PORT, HOST, () => {
  console.log(`HTTPS server running at https://localhost:${PORT}`);
  console.log(`Check from phone at your LAN IP, example: https://192.168.x.x:${PORT}`);
});
