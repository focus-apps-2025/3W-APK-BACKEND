// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For password hashing

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/.+@.+\..+/, 'Please use a valid email address']
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false // Don't return password by default
    },
    role: {
        type: String,
        enum: ['admin', 'team_leader', 'team_member'], // Enforce roles
        default: 'team_member'
    },
    isActive: { // For deactivating users
        type: Boolean,
        default: true
    },
    // For password reset functionality
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare passwords
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);