// backend/models/uploadmetadata.js
const mongoose = require('mongoose');
const uploadMetadataSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
  recordCount: { type: Number, default: 0 },
  totalReceived: Number,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedByEmail: String,
  processingTimeMs: Number,
}, { timestamps: true });

module.exports = mongoose.model('UploadMetadata', uploadMetadataSchema);
