# 🌿 LastKind — Endangered Species Platform

A full-stack web application built with **Node.js + Express + MongoDB** to track endangered and extinct species. Upload real images and videos stored locally on the server.

## 🗂️ Project Structure

```
lastkind/
├── server/
│   ├── index.js              # Express app entry point
│   ├── seed.js               # Database seeder (20 species)
│   ├── models/
│   │   └── Species.js        # Mongoose schema
│   ├── routes/
│   │   └── species.js        # All API routes
│   └── middleware/
│       └── upload.js         # Multer file upload config
├── public/
│   ├── index.html            # Frontend HTML
│   ├── css/style.css         # All styles
│   ├── js/app.js             # Frontend JS (API client)
│   └── uploads/
│       ├── images/           # Locally stored images
│       └── videos/           # Locally stored videos
├── .env                      # Environment variables
├── package.json
└── README.md
```

## 🚀 Setup & Run

### 1. Install dependencies
```bash
npm install
```

### 2. Make sure MongoDB is running
```bash
# macOS
brew services start mongodb-community

# Ubuntu/Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

### 3. Configure environment
Edit `.env`:
```
PORT=3000
MONGO_URI=mongodb://localhost:27017/lastkind
```

### 4. Seed the database (first time only)
```bash
node server/seed.js
```

### 5. Start the server
```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

### 6. Open in browser
```
http://localhost:3000
```

---

## 📡 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/species` | List all species (supports `?cat=`, `?status=`, `?search=`) |
| GET | `/api/species/stats` | Dashboard statistics |
| GET | `/api/species/:id` | Get single species |
| POST | `/api/species` | Create new species |
| PUT | `/api/species/:id` | Update species |
| DELETE | `/api/species/:id` | Delete species + media files |
| POST | `/api/species/:id/image` | Upload image (multipart/form-data) |
| POST | `/api/species/:id/video` | Upload video (multipart/form-data) |
| DELETE | `/api/species/:id/image/:mediaId` | Remove one image |
| DELETE | `/api/species/:id/video/:mediaId` | Remove one video |
| GET | `/api/health` | Server health check |

---

## 💾 Local Storage

Uploaded files are saved to:
- `public/uploads/images/` — images (max 10MB each)
- `public/uploads/videos/` — videos (max 100MB each)

Files are served as static assets at `/uploads/images/filename.jpg`

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| File Upload | Multer (local disk storage) |
| Frontend | Vanilla JS + Leaflet.js |
| Styling | Custom CSS with CSS Variables |
