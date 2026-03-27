// backend/routes/master_routes.js
const { protect, authorize } = require('../middleware/authMiddleware');
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/master_controller');
// const { protect, authorize } = require('../middleware/auth'); // Uncomment if using auth

router.post('/masterdesc/upload',protect, authorize(['admin']), ctrl.uploadMasterDescriptions);
router.get('/masterdesc/files', protect, authorize(['admin']), ctrl.getUploadedFiles);
router.delete('/masterdesc/files/:id', protect, authorize(['admin']),ctrl.deleteUploadedFile);

module.exports = router;

module.exports = router;
