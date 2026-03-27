// backend/models/tvs_racks.js
const mongoose = require('mongoose');

const TVSRackSchema = new mongoose.Schema({
  rackNo: {
    type: String,
    required: true,
  },
  partNo: {
    type: String,
    required: true,
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
    required: true,
  },
  location: {
    type: String,
    enum: ['LUBRICANTS','PARTS','KIT','CONSUMER PRODUCTS','LOCAL ITEMS','SPARES','ACCESSORIES','3W','2W'],
    required: true,
  },
  siteName: {
    type: String,
    required: true,
    index: true,
  },
  scannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  materialDescription: {
    type: String,
  },
}, {
  timestamps: true,
  collection: 'tvs_racks' // CRITICAL: Explicit collection name
});

// Export as TVSRack (not Rack)
const TVSRack = mongoose.model('TVSRack', TVSRackSchema);

module.exports = TVSRack;