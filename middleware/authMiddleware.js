// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming User model is needed for populating req.user
require('dotenv').config(); // Load environment variables
const asyncHandler = require('./asyncHandler'); // Ensure this path is correct for asyncHandler

// Protect routes - Ensures user is logged in
// Renamed from 'authMiddleware' to 'protect' for consistency with export
const protect = asyncHandler(async (req, res, next) => {
  let token;
  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Attach user to request object (excluding password)
      req.user = await User.findById(decoded.userId).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found for this token' });
      }

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        // Just return 401, no need to log as error since it's expected behavior
        return res.status(401).json({ message: 'Token expired' });
      }

      console.error('Auth middleware token error:', error.message);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
});



// Authorize roles - Restricts access based on user role
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated. User data missing.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `User role ${req.user.role} is not authorized to access this route` });
    }
    next();
  };
};

// CORRECTED EXPORT: Export both protect and authorize as properties of an object
module.exports = { protect, authorize };
