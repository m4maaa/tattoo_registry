const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 5e7
});

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getDefaultStore() {
  return {
    personnel: [],
    selectedId: null,
    updatedAt: new Date().toISOString(),
    reason: 'init'
  };
}

function loadStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      return getDefaultStore();
    }

    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      personnel: Array.isArray(parsed.personnel) ? parsed.personnel : [],
      selectedId: parsed.selectedId || null,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      reason: parsed.reason || 'load'
    };
  } catch (error) {
    console.error('loadStore error:', error);
    return getDefaultStore();
  }
}

function saveStore(payload = {}) {
  const normalized = {
    personnel: Array.isArray(payload.personnel) ? payload.personnel : [],
    selectedId: payload.selectedId || null,
    updatedAt: new Date().toISOString(),
    reason: payload.reason || 'update'
  };

  fs.writeFileSync(STORE_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  const store = loadStore();
  res.json({
    ok: true,
    personnelCount: store.personnel.length,
    updatedAt: store.updatedAt
  });
});

io.on('connection', (socket) => {
  console.log('client connected:', socket.id);

  socket.on('requestState', () => {
    socket.emit('stateSnapshot', loadStore());
  });

  socket.on('replaceState', (payload = {}) => {
    try {
      const saved = saveStore(payload);
      io.emit('stateUpdated', saved);
    } catch (error) {
      console.error('replaceState error:', error);
      socket.emit('serverError', { message: 'save failed' });
    }
  });

  socket.on('disconnect', () => {
    console.log('client disconnected:', socket.id);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});