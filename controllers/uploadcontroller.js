// backend/controllers/uploadcontroller.js

const MasterDescription = require('../models/Materialdesc'); // or your actual model
const UploadMetadata = require('../models/uploadmetadata'); // your metadata model
//===========================================================================================================
// @desc    Upload master descriptions from Excel @route   POST /api/upload/masterdescriptions @access  Private (admin)
// @desc    Get list of uploaded files with metadata @route   GET /api/upload/files @access  Private (admin)
//=========================================================================================================== 
exports.uploadMasterDescriptions = async (req, res) => {
  try {
    const { entries, filename } = req.body;
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'No data provided' });
    }

    // Insert all rows from Excel into master description collection
    const insertedDocs = await MasterDescription.insertMany(entries, { ordered: false });

    // Save metadata about this upload - filename, date, and record count
    await UploadMetadata.create({
      filename,
      uploadDate: new Date(), // optional because model has default
      recordCount: insertedDocs.length,
    });

    res.status(201).json({ success: true, message: 'Upload successful', count: insertedDocs.length });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
//===========================================================================================================
// @desc    Get list of uploaded files with metadata @route   GET /api/upload/files @access  Private (admin)
//=========================================================================================================== 
exports.getUploadedFiles = async (req, res) => {
  try {
    const files = await UploadMetadata.find().sort({ uploadDate: -1 });
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch uploaded files', error: error.message });
  }
};

