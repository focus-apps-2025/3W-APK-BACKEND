// backend/controllers/authController.js
const User = require('../models/User');
const Team = require('../models/Team'); // Make sure to import Team model
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Make sure to import bcryptjs for password hashing
require('dotenv').config();
const asyncHandler = require('../middleware/asyncHandler'); // NEW: Import asyncHandler
const logger = require('../utils/logger'); // Import Winston logger

// Helper function to generate JWT token (ensure this is defined if not globally)
const generateAccessToken = (user) => {
  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '15m', // Security constraint: Short lived token
  });
};
// Helper function to generate Refresh Token
const generateRefreshToken = (user) => {
  return jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
  });
};

// Helper function to get user's team and auditType
const getUserAuditType = async (userId) => {
  try {
    // Find which team this user belongs to (as leader or member)
    const team = await Team.findOne({
      $or: [
        { teamLeader: userId },
        { members: userId }
      ],
      status: 'Active'
    });
    
    if (team) {
      return {
        teamId: team._id,
        auditType: team.auditType || 'TVS' // Default to TVS if not set
      };
    }
    
    return { teamId: null, auditType: 'TVS' }; // Default
  } catch (error) {
    logger.error('Error getting user audit type:', error);
    return { teamId: null, auditType: 'TVS' };
  }
};

// NEW: Get current user with auditType
exports.getCurrentUser = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get user's team and auditType
    const { teamId, auditType } = await getUserAuditType(user._id);
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        teamId: teamId,
        auditType: auditType
      }
    });
  } catch (error) {
    logger.error('Error getting current user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

exports.loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account is inactive. Please contact admin.' });
  }

  // Get user's team and auditType
  const { teamId, auditType } = await getUserAuditType(user._id);
  
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Set HttpOnly cookie on response
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'None',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      teamId: teamId, // NEW: Added
      auditType: auditType, // NEW: Added
    },
  });
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, message: 'No refresh token provided.' });
  }

  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid refresh token.' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(403).json({ success: false, message: 'User not found.' });
    }

    // Get user's team and auditType
    const { teamId, auditType } = await getUserAuditType(user._id);
    
    // Regenerate both tokens
    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Send updated HttpOnly cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'None',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        teamId: teamId, // NEW: Added
        auditType: auditType, // NEW: Added
      },
    });
  });
});


exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'None',
  });
  res.json({ success: true, message: "Logged out successfully" });
});


// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Admin only
// MODIFIED: Wrapped with asyncHandler
exports.getActiveAdminsCount = asyncHandler(async (req, res) => {
    try {
        const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
        return res.status(200).json({ success: true, count: adminCount });
    } catch (error) {
        logger.error('Error fetching active admin count:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching admin count.' });
    }
});

// MODIFIED: Wrapped with asyncHandler
exports.registerUser = async (req, res) => {
  const { name, email, password, role, isActive } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: "Please enter all required fields: name, email, password, role" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User with this email already exists" });
    }

    const user = new User({
      name,
      email,
      password,   // Will be hashed by pre-save hook
      role,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    logger.error("Register error stack:", err.stack);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Email already registered." });
    }
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
};


// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private (Admin)
// MODIFIED: Wrapped with asyncHandler
exports.getUsers = asyncHandler(async (req, res) => {
    try {
        // Get all users and populate their team/auditType info
        const users = await User.find({}).select("-password");
        
        // For each user, get their auditType
        const usersWithAuditType = await Promise.all(users.map(async (user) => {
          const { teamId, auditType } = await getUserAuditType(user._id);
          return {
            ...user.toObject(),
            teamId: teamId,
            auditType: auditType
          };
        }));
        
        res.status(200).json({ success: true, users: usersWithAuditType });
    } catch (error) {
        logger.error("Error fetching users:", error);
        res.status(500).json({ success: false, message: "Server error fetching users" });
    }
});

// @desc    Get users by role (e.g., only 'team_member' for team assignment)
// @route   GET /api/auth/users/role/:role
// @access  Private (Admin, Team Leader) - Team Leader can only request 'team_member' role
// MODIFIED: Wrapped with asyncHandler
exports.getUsersByRole = asyncHandler(async (req, res) => {
    const targetRole = req.params.role;

    // Authorization check for Team Leaders (assuming req.user is populated by authMiddleware)
    if (req.user.role === 'team_leader' && targetRole !== 'team_member') {
        return res.status(403).json({ success: false, message: "Team Leaders can only fetch 'team_member' users." });
    }

    try {
        let users;
        if (targetRole === 'team_member') {
            // Find all active teams
            const activeTeams = await Team.find({ status: 'Active' });

            // Extract IDs of all team members currently in active teams
            const membersInActiveTeams = activeTeams.flatMap(team => team.members);

            // Find 'team_member' users who are active (globally) AND not in any active team
            users = await User.find({
                role: targetRole,
                isActive: true, // Only consider globally active users
                _id: { $nin: membersInActiveTeams } // Exclude members already in active teams
            }).select("-password");

        } else {
            // For other roles (e.g., 'admin', 'team_leader'), just fetch as before
            users = await User.find({ role: targetRole, isActive: true }).select("-password");
        }
        
        // Add auditType to each user
        const usersWithAuditType = await Promise.all(users.map(async (user) => {
          const { teamId, auditType } = await getUserAuditType(user._id);
          return {
            ...user.toObject(),
            teamId: teamId,
            auditType: auditType
          };
        }));

        res.status(200).json({ success: true, users: usersWithAuditType });
    } catch (error) {
        logger.error(`Error fetching users with role ${targetRole}:`, error);
        res.status(500).json({ success: false, message: `Server error fetching users with role ${targetRole}` });
    }
});

// @desc    Update a user (Admin only)
// @route   PUT /api/auth/users/:id
// @access  Private (Admin)
// MODIFIED: Wrapped with asyncHandler
exports.updateUser = asyncHandler(async (req, res) => {
    const { name, email, role, isActive, password } = req.body; // Include password if it can be updated

    try {
        const user = await User.findById(req.params.id).select('+password'); // Select password to potentially hash if updated
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Prevent changing admin status from non-admin
        if (user.role === 'admin' && req.body.role !== 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only an admin can demote another admin." });
        }

        user.name = name || user.name;
        user.email = email || user.email;
        user.role = role || user.role;
        user.isActive = (isActive !== undefined) ? isActive : user.isActive;

        // If password is provided, update it (pre-save hook will hash it)
        if (password) {
            user.password = password;
        }

        const updatedUser = await user.save();
        
        // Get updated auditType
        const { teamId, auditType } = await getUserAuditType(updatedUser._id);
        
        // Return user without password but with auditType
        res.status(200).json({
            success: true,
            message: "User updated successfully",
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                isActive: updatedUser.isActive,
                teamId: teamId,
                auditType: auditType
            }
        });
    } catch (error) {
        logger.error("Error updating user:", error);
        res.status(500).json({ success: false, message: "Server error updating user" });
    }
});

// @desc    Delete a user (Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private (Admin)
// MODIFIED: Wrapped with asyncHandler
exports.deleteUser = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (user.role === 'admin') {
            const activeAdminsCount = await User.countDocuments({ role: 'admin', isActive: true });
            if (activeAdminsCount <= 1 && user.isActive) {
                return res.status(403).json({ success: false, message: 'Cannot delete the last active administrator account.' });
            }
        }
        // Prevent admin from deleting themselves
        if (req.user.id === req.params.id) {
            return res.status(403).json({ success: false, message: "Cannot delete your own account." });
        }
        // Prevent admin from deleting other admins directly (optional, but good practice)
        if (user.role === 'admin' && req.user.role === 'admin' && req.user.id !== user._id.toString()) { // Ensure not deleting self
            return res.status(403).json({ success: false, message: "Admins cannot delete other admin accounts directly. Consider demoting first." });
        }

        await User.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        logger.error("Error deleting user:", error);
        res.status(500).json({ success: false, message: "Server error deleting user" });
    }
});

// TODO: Implement forgotPassword and resetPassword functions here later