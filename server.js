import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const __filename = fileURLToPath(import.meta.url);
   app.use(express.static(path.join(__dirname, '.')));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Banco simples em JSON (persiste enquanto o container estiver ativo)
// Para persistência total na Railway, adicione um Volume em /app/data
const dbFile = process.env.DB_PATH || 'db.json';
const db = new Low(new JSONFile(dbFile), { users: [], messages: [] });
await db.read();
db.data ||= { users: [], messages: [] };

const sessions = new Map();
const online = new Map();

function auth(req, res, next) {
  const token = req.headers['x-token'];
  const user = sessions.get(token);
  if (!user) return res.status(401).json({ error: 'unauth' });
  req.user = user;
  next();
}

app.post('/api/register', async (req, res) => {
  const { email, pass, name, photo } = req.body;
  if (!email || !pass || !name) return res.status(400).json({ error: 'missing' });
  if (db.data.users.find(u => u.email === email)) return res.status(400).json({ error: 'exists' });
  const hash = await bcrypt.hash(pass, 8);
  const user = { id: Date.now().toString(), email, name, photo: photo || '', pass: hash };
  db.data.users.push(user);
  await db.write();
  const token = Math.random().toString(36).slice(2);
  sessions.set(token, user);
  res.json({ token, user: { id: user.id, name, photo: user.photo } });
});

app.post('/api/login', async (req, res) => {
  const { email, pass } = req.body;
  const user = db.data.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'notfound' });
  const ok = await bcrypt.compare(pass, user.pass);
  if (!ok) return res.status(400).json({ error: 'wrong' });
  const token = Math.random().toString(36).slice(2);
  sessions.set(token, user);
  res.json({ token, user: { id: user.id, name: user.name, photo: user.photo } });
});

app.get('/api/messages', auth, (req, res) => res.json(db.data.messages.slice(-100)));
app.get('/api/online', auth, (req, res) => res.json(Array.from(online.values())));

io.use((socket, next) => {
  const user = sessions.get(socket.handshake.auth.token);
  if (!user) return next(new Error('unauth'));
  socket.user = user;
  next();
});

io.on('connection', (socket) => {
  const u = socket.user;
  online.set(u.id, { id: u.id, name: u.name, photo: u.photo });
  io.emit('online', Array.from(online.values()));
  socket.on('msg', async (text) => {
    const msg = { id: Date.now(), userId: u.id, name: u.name, photo: u.photo, text, time: new Date().toISOString() };
    db.data.messages.push(msg);
    if (db.data.messages.length > 200) db.data.messages.shift();
    await db.write();
    io.emit('msg', msg);
  });
  socket.on('disconnect', () => {
    online.delete(u.id);
    io.emit('online', Array.from(online.values()));
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log('Chat v4 rodando na porta', PORT));
