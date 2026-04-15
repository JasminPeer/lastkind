const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();
const Species  = require('../models/Species');
const { uploadImage, uploadVideo, uploadAny } = require('../middleware/upload');

// ── helper: build public URL from file path ──────────────────
const toUrl = (filePath) => {
  const rel = filePath.split(/public[/\\]/)[1];
  return '/' + rel.replace(/\\/g, '/');
};

// ══════════════════════════════════════════════════════════════
//  GET  /api/species          — list all (with optional filters)
// ══════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { cat, status, search, limit = 100, page = 1 } = req.query;
    const query = {};
    if (cat)    query.cat    = cat;
    if (status) query.status = status;
    if (search) query.$text  = { $search: search };

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Species.countDocuments(query);
    const data  = await Species.find(query)
                               .skip(skip)
                               .limit(parseInt(limit))
                               .sort({ name: 1 });

    res.json({ success: true, total, page: parseInt(page), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  GET  /api/species/stats    — dashboard statistics
// ══════════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const [byStatus, byCat, total] = await Promise.all([
      Species.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Species.aggregate([{ $group: { _id: '$cat',    count: { $sum: 1 } } }]),
      Species.countDocuments()
    ]);
    res.json({ success: true, total, byStatus, byCat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  GET  /api/species/:id      — single species
// ══════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const sp = await Species.findById(req.params.id);
    if (!sp) return res.status(404).json({ success: false, message: 'Species not found' });
    res.json({ success: true, data: sp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  POST /api/species          — create new species
// ══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const sp = new Species(req.body);
    await sp.save();
    res.status(201).json({ success: true, data: sp });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  PUT  /api/species/:id      — update species
// ══════════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  try {
    const sp = await Species.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!sp) return res.status(404).json({ success: false, message: 'Species not found' });
    res.json({ success: true, data: sp });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  DELETE /api/species/:id    — delete species + its media files
// ══════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const sp = await Species.findById(req.params.id);
    if (!sp) return res.status(404).json({ success: false, message: 'Species not found' });

    // Remove all local media files
    [...sp.images, ...sp.videos].forEach(m => {
      if (m.path && fs.existsSync(m.path)) fs.unlinkSync(m.path);
    });

    await Species.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  POST /api/species/:id/image   — upload image for a species
// ══════════════════════════════════════════════════════════════
router.post('/:id/image', (req, res) => {
  uploadImage(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });

    try {
      const sp = await Species.findById(req.params.id);
      if (!sp) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, message: 'Species not found' });
      }

      const media = {
        filename:     req.file.filename,
        originalname: req.file.originalname,
        mimetype:     req.file.mimetype,
        size:         req.file.size,
        path:         req.file.path,
        url:          toUrl(req.file.path)
      };
      sp.images.push(media);
      await sp.save();

      res.status(201).json({ success: true, data: sp.images[sp.images.length - 1], species: sp });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
});

// ══════════════════════════════════════════════════════════════
//  POST /api/species/:id/video   — upload video for a species
// ══════════════════════════════════════════════════════════════
router.post('/:id/video', (req, res) => {
  uploadVideo(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No video file provided' });

    try {
      const sp = await Species.findById(req.params.id);
      if (!sp) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, message: 'Species not found' });
      }

      const media = {
        filename:     req.file.filename,
        originalname: req.file.originalname,
        mimetype:     req.file.mimetype,
        size:         req.file.size,
        path:         req.file.path,
        url:          toUrl(req.file.path)
      };
      sp.videos.push(media);
      await sp.save();

      res.status(201).json({ success: true, data: sp.videos[sp.videos.length - 1], species: sp });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
});

// ══════════════════════════════════════════════════════════════
//  DELETE /api/species/:id/image/:mediaId  — remove one image
// ══════════════════════════════════════════════════════════════
router.delete('/:id/image/:mediaId', async (req, res) => {
  try {
    const sp = await Species.findById(req.params.id);
    if (!sp) return res.status(404).json({ success: false, message: 'Species not found' });

    const img = sp.images.id(req.params.mediaId);
    if (!img) return res.status(404).json({ success: false, message: 'Image not found' });

    if (img.path && fs.existsSync(img.path)) fs.unlinkSync(img.path);
    img.deleteOne();
    await sp.save();

    res.json({ success: true, message: 'Image removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  DELETE /api/species/:id/video/:mediaId  — remove one video
// ══════════════════════════════════════════════════════════════
router.delete('/:id/video/:mediaId', async (req, res) => {
  try {
    const sp = await Species.findById(req.params.id);
    if (!sp) return res.status(404).json({ success: false, message: 'Species not found' });

    const vid = sp.videos.id(req.params.mediaId);
    if (!vid) return res.status(404).json({ success: false, message: 'Video not found' });

    if (vid.path && fs.existsSync(vid.path)) fs.unlinkSync(vid.path);
    vid.deleteOne();
    await sp.save();

    res.json({ success: true, message: 'Video removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
