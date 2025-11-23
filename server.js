const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const session = require('express-session');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Session secret (set in env for production)
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_session_secret_change_me';

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions: for production use a proper store (redis, database). MemoryStore is fine for development.
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // set to true if using HTTPS
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 6 // 6 hours
  }
}));

// Ensure ImgProductos exists
const IMG_DIR = path.join(__dirname, 'ImgProductos');
if(!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

// Serve static files (site) and ImgProductos
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use('/ImgProductos', express.static(IMG_DIR));

// configure multer storage to ImgProductos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, IMG_DIR);
  },
  filename: function (req, file, cb) {
    // sanitize and prefix with timestamp
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Authentication helper: read credentials from creds.json
const CREDS_FILE = path.join(__dirname, 'creds.json');
function readCreds(){
  try{ return JSON.parse(fs.readFileSync(CREDS_FILE,'utf8')); }catch(e){ return { user: 'admin', pass: 'admin123' }; }
}
function writeCreds(user, pass){
  fs.writeFileSync(CREDS_FILE, JSON.stringify({ user, pass }, null, 2), 'utf8');
}

function requireAuth(req, res, next){
  if(req.session && req.session.authenticated){
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// POST /upload-image -> saves file and returns public URL (requires session auth)
app.post('/upload-image', requireAuth, upload.single('image'), (req, res) => {
  if(!req.file) return res.status(400).json({ error: 'No file received' });
  const urlPath = '/ImgProductos/' + req.file.filename;
  return res.json({ imageUrl: urlPath });
});

// Delete image endpoint: expects JSON { imageUrl: '/ImgProductos/<file>' } (requires session auth)
app.post('/delete-image', requireAuth, (req, res) => {
  const imageUrl = req.body && req.body.imageUrl;
  if(!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  // accept either full path or filename
  let filename = imageUrl;
  if(filename.startsWith('/')){
    // expected '/ImgProductos/<name>'
    const parts = filename.split('/');
    filename = parts[parts.length-1];
  }
  const target = path.join(IMG_DIR, filename);
  // Ensure target is inside IMG_DIR
  if(!target.startsWith(IMG_DIR)) return res.status(400).json({ error: 'Invalid path' });
  fs.unlink(target, (err)=>{
    if(err){
      // file might not exist
      return res.status(404).json({ error: 'File not found or cannot delete' });
    }
    return res.json({ ok: true });
  });
});

// Session endpoints: login, logout, session status
app.post('/api/login', (req, res) => {
  const { user, pass } = req.body || {};
  const creds = readCreds();
  if(user === creds.user && pass === creds.pass){
    req.session.authenticated = true;
    req.session.user = user;
    return res.json({ ok: true, user });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(()=>{});
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated), user: req.session && req.session.user });
});

// Change credentials (authenticated)
app.post('/api/change-credentials', requireAuth, (req, res) => {
  const { currentUser, currentPass, newUser, newPass } = req.body || {};
  const creds = readCreds();
  if(currentUser === creds.user && currentPass === creds.pass){
    writeCreds(newUser || creds.user, newPass || creds.pass);
    return res.json({ ok: true });
  }
  return res.status(400).json({ error: 'Current credentials incorrect' });
});

app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});
