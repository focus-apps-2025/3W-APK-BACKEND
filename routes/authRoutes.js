// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validationMiddleware');

// Import the controller functions
const {
    registerUser,
    loginUser,
    getUsers,
    getUsersByRole,
    updateUser,
    deleteUser,
    getActiveAdminsCount,
    refreshToken,
    logout,
    getCurrentUser, // NEW: Import getCurrentUser
    // Add forgotPassword, resetPassword functions later
} = require('../controllers/authcontroller');

// Import your middleware functions
const { protect, authorize } = require('../middleware/authMiddleware');

// Define your authentication routes

// Public routes (no authentication needed)
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/login', [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required').isString(),
    validateRequest
], loginUser);

// Protected routes (require authentication)
router.get('/current', protect, getCurrentUser); // NEW: Get current user with auditType

// Admin-only routes (require admin role)
router.post('/register', protect, authorize(['admin']), [
    body('name').notEmpty().withMessage('Name is required').trim().escape(),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').isIn(['admin', 'team_leader', 'team_member']).withMessage('Invalid role'),
    validateRequest
], registerUser);
router.get('/users', protect, authorize(['admin']), getUsers);
router.put('/users/:id', protect, authorize(['admin']), updateUser);
router.delete('/users/:id', protect, authorize(['admin']), deleteUser);
router.get('/users/admins/count', protect, authorize(['admin']), getActiveAdminsCount);

// Admin or Team Leader routes
router.get('/users/role/:role', protect, authorize(['admin', 'team_leader']), getUsersByRole);

module.exports = router;