// backend/models/ExportedRack.js
const mongoose = require('mongoose');
const ExportedRackSchema = new mongoose.Schema({
    sNo: { type: Number, required: true },
    location: { type: String, required: true, trim: true },
    rackNo: { type: String, required: true, trim: true },
    partNo: { type: String, required: true, trim: true },
    nextQty: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: false, default: null, min: 0 },
    ndp: { type: Number, required: false, default: null, min: 0 },
    materialDescription: { type: String, trim: true, default: '' },
    exportedAt: { type: Date, default: Date.now },
    team: { type: mongoose.Schema.ObjectId, ref: 'Team', required: true },
    siteName: { type: String, required: true, trim: true },
    exportedBy: { type: mongoose.Schema.ObjectId, ref: 'User', required: true }
});

ExportedRackSchema.index({ team: 1, exportedAt: -1 });
ExportedRackSchema.index({ siteName: 1, exportedAt: -1 });

// Use the name 'ExportedRack' as you defined
module.exports = mongoose.model('ExportedRack', ExportedRackSchema);