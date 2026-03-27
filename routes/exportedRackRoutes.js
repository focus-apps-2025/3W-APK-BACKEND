// backend/routes/exportedRackSnapshotRoutes.js
const express = require('express');
const { createExportedSnapshots } = require('../controllers/exportedrackcontroller');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .post(protect, authorize(['admin', 'team_leader']), createExportedSnapshots);

module.exports = router;
