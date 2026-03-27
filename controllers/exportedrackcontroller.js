// backend/controllers/exportedrackcontroller.js
const TVSExportedRackSnapshot = require('../models/Tvs_exportedrack');
const TATAExportedRackSnapshot = require('../models/Tata_exportedrack');
const Team = require('../models/Team');
const asyncHandler = require('../middleware/asyncHandler');

// Helper function to get the correct exported rack model based on auditType
const getExportedRackModel = (auditType) => {
  switch (auditType) {
    case 'TVS':
      return TVSExportedRackSnapshot;
    case 'TATA':
      return TATAExportedRackSnapshot;
    default:
      throw new Error(`Unsupported audit type: ${auditType}`);
  }
};

//===========================================================================================================
// @desc    Create multiple exported rack snapshots @route   POST /api/exportedracks @access  Private (admin or team leader)
//===========================================================================================================
exports.createExportedSnapshots = asyncHandler(async (req, res, next) => {
  const { snapshots, teamId, siteName } = req.body;
  const exportedBy = req.user._id;

  if (!snapshots || !Array.isArray(snapshots) || snapshots.length === 0) {
    return res.status(400).json({ success: false, message: 'No snapshot data provided.' });
  }
  if (!teamId || !siteName) {
    return res.status(400).json({ success: false, message: 'Team ID and Site Name are required.' });
  }

  const teamExists = await Team.findById(teamId);
  if (!teamExists) {
    return res.status(404).json({ success: false, message: `Team with ID ${teamId} not found.` });
  }

  const isAuthorized = req.user.role === 'admin' || 
                       (teamExists.teamLeader && teamExists.teamLeader.toString() === exportedBy.toString());

  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: 'Not authorized for this team.' });
  }

  // Get the correct model based on team's auditType
  const ExportedRackModel = getExportedRackModel(teamExists.auditType);

  const snapshotsToSave = snapshots.map(snapshot => ({
    ...snapshot, // Includes sNo, rackNo, partNo, etc. from the client
    team: teamId,
    siteName: siteName,
    exportedBy: exportedBy
  }));

  try {
    const result = await ExportedRackModel.insertMany(snapshotsToSave);
    res.status(201).json({
      success: true,
      message: `${result.length} rack snapshots saved successfully for ${teamExists.auditType}.`,
      count: result.length,
      auditType: teamExists.auditType
    });
  } catch (error) {
    console.error("Error saving exported rack snapshots:", error);
    res.status(500).json({ success: false, message: 'Server error saving snapshots.' });
  }
});

//===========================================================================================================
// @desc    Get exported racks by team @route   GET /api/exportedracks @access  Private (admin or team leader)
//===========================================================================================================
exports.getExportedSnapshots = asyncHandler(async (req, res, next) => {
  const { teamId } = req.query;
  
  if (!teamId) {
    return res.status(400).json({ success: false, message: 'Team ID is required.' });
  }

  const team = await Team.findById(teamId);
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found.' });
  }

  // Authorization check
  const isAuthorized = req.user.role === 'admin' || 
                       (team.teamLeader && team.teamLeader.toString() === req.user._id.toString());

  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: 'Not authorized to view exported racks for this team.' });
  }

  // Get the correct model based on team's auditType
  const ExportedRackModel = getExportedRackModel(team.auditType);

  try {
    const exportedRacks = await ExportedRackModel.find({ team: teamId })
      .populate('exportedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: exportedRacks.length,
      data: exportedRacks,
      auditType: team.auditType
    });
  } catch (error) {
    console.error("Error fetching exported racks:", error);
    res.status(500).json({ success: false, message: 'Server error fetching exported racks.' });
  }
});

//===========================================================================================================
// @desc    Delete exported racks by team @route   DELETE /api/exportedracks/:teamId @access  Private (admin or team leader)
//===========================================================================================================
exports.deleteExportedSnapshots = asyncHandler(async (req, res, next) => {
  const { teamId } = req.params;

  const team = await Team.findById(teamId);
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found.' });
  }

  // Authorization check
  const isAuthorized = req.user.role === 'admin' || 
                       (team.teamLeader && team.teamLeader.toString() === req.user._id.toString());

  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete exported racks for this team.' });
  }

  // Get the correct model based on team's auditType
  const ExportedRackModel = getExportedRackModel(team.auditType);

  try {
    const result = await ExportedRackModel.deleteMany({ team: teamId });
    
    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} exported rack snapshots for ${team.auditType}.`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Error deleting exported racks:", error);
    res.status(500).json({ success: false, message: 'Server error deleting exported racks.' });
  }
});