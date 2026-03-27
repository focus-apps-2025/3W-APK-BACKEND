// backend/models/Team.js
const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
    siteName: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    // NEW FIELD: Audit type (TVS or TATA)
    auditType: {
        type: String,
        enum: ['TVS', 'TATA'],
        required: true,
        default: 'TVS'
    },
    // Reference to the Team Leader (a User)
    teamLeader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        default: null,
    },
    // Array of references to Team Members (Users)
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    status: { // e.g., 'active', 'completed', 'archived'
        type: String,
        enum: ['Active', 'Completed', 'Archived'],
        default: 'active'
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

module.exports = mongoose.model('Team', TeamSchema);