// backend/models/Rack.js
const mongoose = require('mongoose');
const RackSchema = new mongoose.Schema({
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
    enum: ['LUBRICANT','PARTS','KIT','CONSUMER PRODUCTS','LOCAL ITEMS','SPARES','ACCESSORIES','BATTERY','FIAT SPARES','NANO SPARES','TYRE'], // Allowed values
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
    type: String, // optional text from MaterialDescription
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

const Rack = mongoose.model('Rack', RackSchema);

module.exports = Rack;
