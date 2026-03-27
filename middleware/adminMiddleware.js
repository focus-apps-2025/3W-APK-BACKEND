// backend/middleware/adminMiddleware.js
const adminMiddleware = (req, res, next) => {
    // Assumes req.user is populated by authMiddleware
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
};
module.exports = adminMiddleware;