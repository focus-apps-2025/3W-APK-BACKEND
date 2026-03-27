// backend/routes/teamroutes.js
const express = require('express');
const router = express.Router();

// Import the controller functions
const {
    createTeam,
    getTeams,
    getTeamById,
    updateTeam,
    deleteTeam,
    addTeamMember,
    removeTeamMember,
    getTeamsForMember,
    getTeamsByLeaderId,
    completeTeamWork,
    getTeamWorkStatus,
    

} = require('../controllers/teamcontroller'); // Corrected typo: teamcontroller to teamController

// Import your middleware files
const { protect, authorize } = require('../middleware/authMiddleware'); 
console.log('DEBUG in teamRoutes.js: typeof completeTeamWork:', typeof completeTeamWork);
// Correct import for protect and authorize

// Routes for Team Management
router.route('/')
    // Replaced 'authMiddleware, teamLeaderMiddleware' with 'protect, authorize'
    .post(protect, authorize(['admin', 'team_leader']), createTeam) // Needs auth and TL/Admin check
    .get(protect, authorize(['admin', 'team_leader', 'team_member']), getTeams); // Needs auth, and all roles can get teams (controller filters)
router.route('/:id/status').get(protect, getTeamWorkStatus);

router.route('/:id')    // Replaced 'authMiddleware, teamLeaderMiddleware' with 'protect, authorize'
    .get(protect, authorize(['admin', 'team_leader', 'team_member']), getTeamById) // Needs auth, and all roles can get team by ID
    .put(protect, authorize(['admin', 'team_leader']), updateTeam) // Needs auth and TL/Admin check
    .delete(protect, authorize(['admin','team_leader']), deleteTeam); // Admin only for delete

// Replaced 'authMiddleware, teamLeaderMiddleware' with 'protect, authorize'
router.put('/:id/add-member', protect, authorize(['admin', 'team_leader']), addTeamMember);
router.put('/:id/remove-member', protect, authorize(['admin', 'team_leader']), removeTeamMember);



// New route for fetching teams a specific member is assigned to
// Replaced 'authMiddleware' with 'protect'
router.get('/member/:memberId', protect, getTeamsForMember); // Needs auth, controller handles role check
router.get('/leader/:leaderId', protect, getTeamsByLeaderId); // Needs auth, controller handles role check


router.route('/:id/complete') // NEW: Route for completing team work
    .put(protect, authorize(['admin', 'team_leader']), completeTeamWork); 


    
module.exports = router;
