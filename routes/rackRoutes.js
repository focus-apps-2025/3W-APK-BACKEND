// backend/routes/rackRoutes.js
const express = require('express');
const {
    createRack,
    getRacks,
    getRackById,
    updateRack,
    deleteRack,
    exportRacks,
    getScanCountsByUser,
    getFirstScanByUser,
    getRackByPartNo,
    downloadRacksAsExcel,
    checkPartNoInMaster
} = require('../controllers/rackcontroller');

// Auth middleware
const { protect, authorize } = require('../middleware/authMiddleware');

// Initialize router
const router = express.Router();

// 1.EXPORT RACKS

router.route('/download-excel')
    .get(protect, authorize(['admin', 'team_leader', 'team_member']), downloadRacksAsExcel);
router.route('/export')
    .get(protect, authorize(['admin', 'team_leader', 'team_member']), exportRacks);

// 2. SCAN COUNTS ROUTE
router.route('/scancounts')
    .get(protect, getScanCountsByUser);
router.route('/check-master/:partNo/:siteName')
    .get(checkPartNoInMaster);


// 3. FIRST SCAN BY USER ROUTE
router.route('/first-scan-by-user')
    .get(protect, authorize(['admin', 'team_leader', 'team_member']), getFirstScanByUser);

// 4. ROUTE WITH MULTIPLE PARAMETERS - More specific than single ID
router.route('/team/:siteName/part/:partNo')
    .get(protect, authorize(['admin', 'team_leader', 'team_member']), getRackByPartNo);

// 5. MAIN ROUTES - Less specific than above
router.route('/')
    .post(protect, authorize(['admin', 'team_leader', 'team_member']), createRack)
    .get(protect, authorize(['admin', 'team_leader', 'team_member']), getRacks);

// 6. SINGLE ID ROUTE - Most generic, should come LAST
router.route('/:id')
    .get(protect, authorize(['admin', 'team_leader', 'team_member']), getRackById)
    .put(protect, authorize(['admin', 'team_leader']), updateRack)
    .delete(protect, authorize(['admin', 'team_leader']), deleteRack);

module.exports = router;