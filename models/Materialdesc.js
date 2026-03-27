// backend/models/Materialdesc.js
const mongoose = require('mongoose');
const masterDescriptionSchema = new mongoose.Schema({
  partNo: String,
  description: String,
  ndp: Number,
  mrp: Number,
  uploadBatch: String,
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadMetadata' },
}, { timestamps: true });

module.exports = mongoose.model('MasterDescription', masterDescriptionSchema);
