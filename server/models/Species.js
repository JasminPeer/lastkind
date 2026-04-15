const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  filename:     { type: String, required: true },
  originalname: { type: String },
  mimetype:     { type: String },
  size:         { type: Number },
  path:         { type: String, required: true },
  url:          { type: String, required: true },
  uploadedAt:   { type: Date, default: Date.now }
});

const speciesSchema = new mongoose.Schema({
  name:         { type: String, required: true, unique: true, trim: true },
  sci:          { type: String, required: true, trim: true },
  cat:          { type: String, required: true, enum: ['Mammals','Birds','Insects','Marine Life','Reptiles & Amphibians','Plants & Flowers'] },
  status:       { type: String, required: true, enum: ['Critically Endangered','Endangered','Vulnerable','Rare','Extinct'] },
  pop:          { type: Number, default: null },
  years:        { type: String },
  habitat:      { type: String },
  loc:          { type: [Number], default: [] },   // [lat, lng]
  desc:         { type: String },
  behavior:     { type: String },
  causes:       { type: [String], default: [] },
  conservation: { type: String },
  emoji:        { type: String, default: '🐾' },
  img:          { type: String },                  // external/default image URL
  vid:          { type: String },                  // YouTube video ID
  extinct_year: { type: Number },
  // Locally stored media
  images:       { type: [mediaSchema], default: [] },
  videos:       { type: [mediaSchema], default: [] },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
}, { timestamps: true });

speciesSchema.index({ name: 'text', sci: 'text', habitat: 'text' });

module.exports = mongoose.model('Species', speciesSchema);
