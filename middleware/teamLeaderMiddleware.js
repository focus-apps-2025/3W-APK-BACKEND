// backend/middleware/teamLeaderMiddleware.js
const teamLeaderMiddleware = (req, res, next) => {
    // Assumes req.user is populated by authMiddleware
    if (req.user && (req.user.role === 'team_leader' || req.user.role === 'admin')) { // Admins can also do TL actions
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Team Leader or Admin access required' });
    }
};
module.exports = teamLeaderMiddleware;