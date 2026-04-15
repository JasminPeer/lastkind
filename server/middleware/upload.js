const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── ensure upload dirs exist ─────────────────────────────────
const imgDir = path.join(__dirname, '../../public/uploads/images');
const vidDir = path.join(__dirname, '../../public/uploads/videos');
[imgDir, vidDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── storage engine ───────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, file.mimetype.startsWith('image/') ? imgDir : vidDir);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
                     .replace(/[^a-zA-Z0-9]/g, '_')
                     .slice(0, 40);
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

// ── file filter ──────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg','image/jpg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/ogg','video/quicktime'
  ];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
};

// ── exported upload instances ────────────────────────────────
const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }   // 10 MB
}).single('image');

const uploadVideo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }  // 100 MB
}).single('video');

const uploadAny = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
}).single('media');

module.exports = { uploadImage, uploadVideo, uploadAny };
