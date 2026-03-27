// backend/models/tata_exportedracks.js
const mongoose = require('mongoose');

const TATAExportedRackSnapshotSchema = new mongoose.Schema({
  sNo: {
    type: Number,
  },
  rackNo: {
    type: String,
  },
  partNo: {
    type: String,
    index: true,
  },
  mrp: {
    type: Number,
  },
  ndp: {
    type: Number,
  },
  nextQty: {
    type: Number,
  },
  location: {
    type: String,
  },
  siteName: {
    type: String,
    required: true,
    index: true,
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  exportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  materialDescription: {
    type: String,
  },
}, {
  timestamps: true,
  collection: 'tata_exportedracks' // CRITICAL: Different collection name
});

const TATAExportedRackSnapshot = mongoose.model('TATAExportedRackSnapshot', TATAExportedRackSnapshotSchema);
module.exports = TATAExportedRackSnapshot;