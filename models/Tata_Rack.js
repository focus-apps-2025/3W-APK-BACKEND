// backend/models/tata_racks.js
const mongoose = require('mongoose');

const TATARackSchema = new mongoose.Schema({
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
    enum: ['LUBRICANT','PARTS','CONSUMER PRODUCTS','LOCAL ITEMS','SPARES','ACCESSORIES','FIAT SPARES','NANO SPARES','TYRE','BATTERY','DAMAGED','TOOLS','OILS','1-NORMAL PARTS','9-MISCELLENEOUS','2-EXCHANGE PARTS','3-RETROFIT PARTS','LOCAL PARTS','5-RIMSWHEELS','7-BMW LIFESTYLE','8-TIRES'],
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
  cachedMRP: {
    type: Number,
  },
  cachedNDP: {
    type: Number,
  },
  cachedDescription: {
    type: String,
  },
  lastMasterSync: {
    type: Date,
  },
  remark: {
    type: String,
    enum: ['Part number doubtful', 'Without Packing/Label', 'No Remark'],
    default: 'No Remark'
  }
}, {
  timestamps: true,
  collection: 'tata_racks' // CRITICAL: Different collection name
});

// Export as TATARack (not Rack)
const TATARack = mongoose.model('TATARack', TATARackSchema);

module.exports = TATARack;