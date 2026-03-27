// backend/controllers/master_controller.js
const MasterDescription = require('../models/Materialdesc');
const UploadMetadata = require('../models/uploadmetadata');
const mongoose = require('mongoose');
//===========================================================================================================
 //OPTIMIZED Upload master descriptions for large files (25K+ rows)
 //POST /api/masterdesc/upload
//===========================================================================================================

//===========================================================================================================
// POST UPLOAD MASTER DESCRIPTIONS
//===========================================================================================================
exports.uploadMasterDescriptions = async (req, res) => {
  // Start a session for transaction
  const session = await mongoose.startSession();
  try {
    const { entries, filename } = req.body;
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: "No data provided" });
    }

    session.startTransaction();

    // Create metadata
    const [meta] = await UploadMetadata.create([{
      filename,
      totalReceived: entries.length,
      uploadedBy: req.user?._id,
      uploadedByEmail: req.user?.email
    }], { session });

    const fileId = meta._id;

    // Prepare records
    const docs = entries.map(e => ({
      partNo: e.partNo,
      description: e.description,
      ndp: parseFloat(e.ndp) || 0,
      mrp: parseFloat(e.mrp) || 0,
      uploadBatch: filename,
      fileId
    }));
    // Insert records in bulk
    await MasterDescription.insertMany(docs, { session });
    await UploadMetadata.findByIdAndUpdate(fileId, { recordCount: docs.length }, { session });
    // Commit transaction
    await session.commitTransaction();
    res.status(201).json({ success: true, fileId, insertedCount: docs.length, message: "File uploaded successfully" });

  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};
//===========================================================================================================
// GET UPLOADED FILES WITH METADATA
//===========================================================================================================
exports.getUploadedFiles = async (req, res) => {
  try {
    const files = await UploadMetadata.find().sort({ uploadDate: -1 }).lean();
    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
//===========================================================================================================
// DELETE FILE + LINKED RECORDS
//===========================================================================================================
  exports.deleteUploadedFile = async (req, res) => {
  // Start a session for transaction
  const { id } = req.params;
  const session = await mongoose.startSession();
  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid file ID format' });
    }
    // Start transaction
    session.startTransaction();
    const meta = await UploadMetadata.findById(id).session(session);
    if (!meta) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'File metadata not found' });
    }
    // Find and delete linked MasterDescription records
    // Matching by fileId, uploadedFileId, or uploadBatch (filename)
    const query = {
      $or: [
        { fileId: meta._id },
        { uploadedFileId: meta._id },
        { uploadBatch: meta.filename }
      ]
    };
    // Count records before deletion for reporting
    const countBefore = await MasterDescription.countDocuments(query);
    console.log(`Found ${countBefore} linked records to delete...`);
    // Delete linked records
    const delRecords = await MasterDescription.deleteMany(query).session(session);
    await UploadMetadata.deleteOne({ _id: id }).session(session);
    // Commit transaction
    await session.commitTransaction();
    res.json({
      success: true,
      message: `Deleted ${delRecords.deletedCount} records and metadata entry.`,
      deletedRecordsCount: delRecords.deletedCount
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};
