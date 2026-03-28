// backend/controllers/rackcontroller.js
const mongoose = require('mongoose');
const TVSRack = require('../models/Tvs_Rack');
const TATARack = require('../models/Tata_Rack');
const Team = require('../models/Team');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const MasterDescription = require('../models/Materialdesc');

const ExcelJS = require('exceljs');

// Helper function to get the correct model based on auditType
const getRackModel = (auditType) => {
  switch (auditType) {
    case 'TVS':
      return TVSRack;
    case 'TATA':
      return TATARack;
    default:
      throw new Error(`Unsupported audit type: ${auditType}`);
  }
};

// Helper function to get collection name for aggregation
const getRackCollectionName = (auditType) => {
  switch (auditType) {
    case 'TVS':
      return 'tvs_racks';
    case 'TATA':
      return 'tata_racks';
    default:
      throw new Error(`Unsupported audit type: ${auditType}`);
  }
};

//===========================================================================================================
// Check if part number exists in master description and return its details
//===========================================================================================================
exports.checkPartNoInMaster = asyncHandler(async (req, res, next) => {
  const { partNo, siteName } = req.params;

  if (!partNo) {
    return res.status(400).json({
      success: false,
      message: 'Part number is required.'
    });
  }

  // Handle case when siteName is 'undefined' or empty
  const effectiveSiteName = (siteName && siteName !== 'undefined') ? siteName : null;

  // Find the team to get audit type (optional)
  const team = effectiveSiteName ? await Team.findOne({ siteName: effectiveSiteName, status: 'Active' }) : null;
  
  // Search in MasterDescription collection
  const masterData = await MasterDescription.findOne({
    partNo: { $regex: new RegExp('^' + partNo + '$', 'i') } // Case insensitive exact match
  });

  if (!masterData) {
    return res.status(404).json({
      success: false,
      message: 'Part number not found in master data.',
      exists: false
    });
  }

  res.status(200).json({
    success: true,
    exists: true,
    data: {
      partNo: masterData.partNo,
      description: masterData.description,
      mrp: masterData.mrp,
      ndp: masterData.ndp
    }
  });
});

//===========================================================================================================
// Create Rack - accessible by Admin, Team Leader, and Team Member of the team
//===========================================================================================================
exports.createRack = asyncHandler(async (req, res, next) => {
  const { rackNo, partNo, nextQty, siteName, location, remark } = req.body;

  console.log('CREATE RACK REQUEST:', JSON.stringify({ rackNo, partNo, nextQty, siteName, location, remark, userId: req.user?._id, userRole: req.user?.role }));

  // Validate required fields
  if (!rackNo || !partNo || nextQty === undefined || !siteName || !location) {
    return res.status(400).json({
      success: false,
      message: 'Please provide rackNo, partNo, nextQty, siteName, and location.',
    });
  }

  // Validate remark if provided
  if (remark && !['Part number doubtful', 'Without Packing/Label', 'No Remark'].includes(remark)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid remark value. Must be one of: "Part number doubtful", "Without Packing/Label", or "No Remark".',
    });
  }

  // Find the team by siteName (case-insensitive status match for compatibility)
  const team = await Team.findOne({ siteName, status: { $regex: /^active$/i } });
  if (!team) {
    return res.status(404).json({
      success: false,
      message: `Team with siteName '${siteName}' not found or not active.`,
    });
  }

  // Check authorization
  const isAdmin = req.user.role === 'admin';
  const isTeamLeader = req.user.role === 'team_leader' && team.teamLeader && team.teamLeader.toString() === req.user._id.toString();
  const isTeamMember = req.user.role === 'team_member' && team.members.some(m => m.toString() === req.user._id.toString());

  if (!(isAdmin || isTeamLeader || isTeamMember)) {
    return res.status(403).json({ success: false, message: 'Not authorized to create rack for this team.' });
  }

  // Get the correct rack model - fallback to TVS if auditType is missing
  const RackModel = getRackModel(team.auditType || 'TVS');

  // FETCH MASTER DESCRIPTION DATA
  let masterData = null;
  try {
    masterData = await MasterDescription.findOne({ partNo });
  } catch (error) {
    console.log('Master description fetch failed:', error.message);
  }

  // Check for existing rack
  const existingRack = await RackModel.findOne({ partNo, rackNo, team: team._id });

  if (existingRack) {
    // Update existing rack
    existingRack.nextQty += Number(nextQty);
    existingRack.scannedBy = req.user._id;

    // Update cached data if master data exists and is newer
    if (masterData) {
      existingRack.cachedMRP = masterData.mrp;
      existingRack.cachedNDP = masterData.ndp;
      existingRack.cachedDescription = masterData.description;
      existingRack.lastMasterSync = new Date();
    }

    // Update remark for TATA
    if (remark && (team.auditType || 'TVS') === 'TATA') {
      existingRack.remark = remark;
    }

    await existingRack.save();

    // Prepare response with enriched data
    const responseRack = existingRack.toObject();
    responseRack.mrp = responseRack.cachedMRP || responseRack.mrp;
    responseRack.ndp = responseRack.cachedNDP || responseRack.ndp;
    responseRack.materialDescription = responseRack.cachedDescription || responseRack.materialDescription;

    res.status(201).json({
      success: true,
      message: `Rack ${rackNo} quantity updated to ${existingRack.nextQty}`,
      rack: responseRack,
    });
  } else {
    // Create new rack with cached master data
    const rackData = {
      rackNo,
      partNo,
      nextQty,
      team: team._id,
      siteName,
      location,
      scannedBy: req.user._id,
      // Add cached data if available
      cachedMRP: masterData?.mrp,
      cachedNDP: masterData?.ndp,
      cachedDescription: masterData?.description,
      lastMasterSync: masterData ? new Date() : null
    };

    // Add remark for TATA
    if ((team.auditType || 'TVS') === 'TATA') {
      rackData.remark = remark || 'No Remark';
    }

    const newRack = await RackModel.create(rackData);

    // Prepare response with enriched data
    const responseRack = newRack.toObject();
    responseRack.mrp = responseRack.cachedMRP || responseRack.mrp;
    responseRack.ndp = responseRack.cachedNDP || responseRack.ndp;
    responseRack.materialDescription = responseRack.cachedDescription || responseRack.materialDescription;

    res.status(201).json({
      success: true,
      message: 'Rack created successfully',
      rack: responseRack,
    });
  }
});

//===========================================================================================================
// Get all racks with role-based filtering & optional siteName filtering ,server-side pagination and search
//===========================================================================================================
exports.getRacks = asyncHandler(async (req, res, next) => {
  // --- Parameter and Filter Setup ---
  const { siteName, teamId, search, scannedById } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;
  const { date } = req.query;

  // --- User and Team Filtering ---
  let userTeams = [];

  if (req.user.role === 'admin') {
    // Admin can see all teams
    if (teamId) {
      const team = await Team.findById(teamId);
      if (team) userTeams.push(team);
    } else {
      userTeams = await Team.find({});
    }
  } else {
    // Non-admins: get teams they belong to
    if (req.user.role === 'team_leader') {
      userTeams = await Team.find({ teamLeader: req.user._id });
    } else if (req.user.role === 'team_member') {
      userTeams = await Team.find({ members: req.user._id });
    }

    if (teamId && userTeams.length > 0) {
      // Filter to specific team if requested and user has access
      const specificTeam = userTeams.find(t => t._id.toString() === teamId);
      userTeams = specificTeam ? [specificTeam] : [];
    }
  }

  if (userTeams.length === 0) {
    return res.status(200).json({ success: true, count: 0, data: [] });
  }

  // --- N/A SEARCH LOGIC ---
  const isNaSearch = search && (search.toLowerCase() === 'n/a' || search.toLowerCase() === 'na');

  // Group teams by auditType for efficient querying
  const teamsByAuditType = {};
  userTeams.forEach(team => {
    const auditType = team.auditType || 'TVS';
    if (!teamsByAuditType[auditType]) {
      teamsByAuditType[auditType] = [];
    }
    teamsByAuditType[auditType].push(team._id);
  });

  let allResults = [];
  let totalRacks = 0;

  // Query each audit type separately
  for (const [auditType, teamIds] of Object.entries(teamsByAuditType)) {
    const RackModel = getRackModel(auditType || 'TVS');
    const collectionName = getRackCollectionName(auditType || 'TVS');

    const matchFilter = { team: { $in: teamIds } };

    // Apply additional filters
    if (date) {
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');
      matchFilter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    if (siteName) matchFilter.siteName = siteName;
    if (scannedById) matchFilter.scannedBy = new mongoose.Types.ObjectId(scannedById);

    if (isNaSearch) {
      const pipeline = [
        { $match: matchFilter },
        { $lookup: { from: 'masterdescriptions', localField: 'partNo', foreignField: 'partNo', as: 'materialData' } },
        { $unwind: { path: '$materialData', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'teams', localField: 'team', foreignField: '_id', as: 'team' } },
        { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'scannedBy', foreignField: '_id', as: 'scannedBy' } },
        { $unwind: { path: '$scannedBy', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            materialDescription: { $ifNull: ['$materialDescription', '$materialData.description'] },
            mrp: { $ifNull: ['$mrp', '$materialData.mrp'] },
            ndp: { $ifNull: ['$ndp', '$materialData.ndp'] }
          }
        },
        {
          $match: {
            $or: [
              { materialDescription: null },
              { mrp: null },
              { ndp: null }
            ]
          }
        },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [{ $skip: skip }, { $limit: limit }, { $project: { materialData: 0 } }],
          }
        }
      ];

      const results = await RackModel.aggregate(pipeline);
      if (results[0].metadata.length > 0) {
        totalRacks += results[0].metadata[0].total;
      }
      allResults = allResults.concat(results[0].data);
    } else {
      // Regular search
      if (search) {
        matchFilter.$or = [
          { rackNo: { $regex: search, $options: 'i' } },
          { partNo: { $regex: search, $options: 'i' } },
        ];
      }

      const initialResults = await RackModel.aggregate([
        { $match: matchFilter },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [{ $skip: skip }, { $limit: limit }, { $project: { _id: 1 } }],
          },
        },
      ]);

      if (initialResults[0].metadata.length > 0) {
        totalRacks += initialResults[0].metadata[0].total;
      }

      const rackIds = initialResults[0].data.map(r => r._id);

      if (rackIds.length > 0) {
        const detailedRacks = await RackModel.aggregate([
          { $match: { _id: { $in: rackIds } } },
          { $lookup: { from: 'masterdescriptions', localField: 'partNo', foreignField: 'partNo', as: 'materialData' } },
          { $unwind: { path: '$materialData', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'teams', localField: 'team', foreignField: '_id', as: 'team' } },
          { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'users', localField: 'scannedBy', foreignField: '_id', as: 'scannedBy' } },
          { $unwind: { path: '$scannedBy', preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              materialDescription: '$materialData.description',
              mrp: { $ifNull: ['$mrp', '$materialData.mrp'] },
              ndp: { $ifNull: ['$ndp', '$materialData.ndp'] }
            },
          },
          { $project: { materialData: 0 } },
          { $sort: { createdAt: -1 } }
        ]);

        allResults = allResults.concat(detailedRacks);
      }
    }
  }

  // Sort all results by createdAt (most recent first)
  allResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.status(200).json({
    success: true,
    count: totalRacks,
    data: allResults.slice(0, limit)
  });
});


//===========================================================================================================
// Export racks with role-based filtering & optional siteName filtering and search (no pagination)
//===========================================================================================================
exports.exportRacks = asyncHandler(async (req, res, next) => {
  const { teamId, search, date } = req.query;

  // Get team to determine auditType
  const team = await Team.findById(teamId);
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  // Get the correct rack model based on team's auditType
  const RackModel = getRackModel(team.auditType || 'TVS');

  // Build query - FAST pattern (same as downloadRacksAsExcel)
  const query = { team: new mongoose.Types.ObjectId(teamId) };

  if (search && search.toLowerCase() !== 'n/a') {
    query.$or = [
      { rackNo: { $regex: search, $options: 'i' } },
      { partNo: { $regex: search, $options: 'i' } },
    ];
  }

  if (date) {
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');
    query.createdAt = { $gte: startOfDay, $lte: endOfDay };
  }

  // SUPER FAST - direct find with populate, NO AGGREGATION!
  let racks = await RackModel.find(query)
    .sort({ createdAt: -1 })
    .populate('scannedBy', 'name')
    .lean();

  // Handle N/A search filter
  if (search && search.toLowerCase() === 'n/a') {
    racks = racks.filter(rack =>
      !rack.cachedMRP || !rack.cachedNDP || !rack.cachedDescription
    );
  }

  // Use cached fields directly
  const enrichedRacks = racks.map(rack => ({
    ...rack,
    mrp: rack.cachedMRP || rack.mrp || 0,
    ndp: rack.cachedNDP || rack.ndp || 0,
    materialDescription: rack.cachedDescription || rack.materialDescription || '',
    scannedByName: rack.scannedBy?.name || 'Unknown'
  }));

  res.status(200).json({
    success: true,
    count: enrichedRacks.length,
    data: enrichedRacks
  });
});

//===========================================================================================================
// Get single rack by ID (with permission check)
//===========================================================================================================
exports.getRackById = asyncHandler(async (req, res, next) => {
  const rackId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(rackId)) {
    return res.status(400).json({ success: false, message: 'Invalid Rack ID.' });
  }

  // Try to find the rack in both collections
  let rack = null;
  let RackModel = null;

  // Try TVS first
  try {
    const tvsRack = await TVSRack.aggregate([
      { $match: { _id: mongoose.Types.ObjectId(rackId) } },
      { $lookup: { from: 'masterdescriptions', localField: 'partNo', foreignField: 'partNo', as: 'materialData' } },
      { $unwind: { path: '$materialData', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          materialDescription: '$materialData.description',
          mrp: { $ifNull: ['$mrp', '$materialData.mrp'] },
          ndp: { $ifNull: ['$ndp', '$materialData.ndp'] }
        },
      },
      { $project: { materialData: 0 } },
      { $lookup: { from: 'teams', localField: 'team', foreignField: '_id', as: 'team' } },
      { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'scannedBy', foreignField: '_id', as: 'scannedBy' } },
      { $unwind: { path: '$scannedBy', preserveNullAndEmptyArrays: true } }
    ]);

    if (tvsRack.length > 0) {
      rack = tvsRack[0];
      RackModel = TVSRack;
    }
  } catch (error) {
    // Continue to try TATA
  }

  // If not found in TVS, try TATA
  if (!rack) {
    try {
      const tataRack = await TATARack.aggregate([
        { $match: { _id: mongoose.Types.ObjectId(rackId) } },
        { $lookup: { from: 'masterdescriptions', localField: 'partNo', foreignField: 'partNo', as: 'materialData' } },
        { $unwind: { path: '$materialData', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            materialDescription: '$materialData.description',
            mrp: { $ifNull: ['$mrp', '$materialData.mrp'] },
            ndp: { $ifNull: ['$ndp', '$materialData.ndp'] }
          },
        },
        { $project: { materialData: 0 } },
        { $lookup: { from: 'teams', localField: 'team', foreignField: '_id', as: 'team' } },
        { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'scannedBy', foreignField: '_id', as: 'scannedBy' } },
        { $unwind: { path: '$scannedBy', preserveNullAndEmptyArrays: true } }
      ]);

      if (tataRack.length > 0) {
        rack = tataRack[0];
        RackModel = TATARack;
      }
    } catch (error) {
      // Continue
    }
  }

  if (!rack) {
    return res.status(404).json({ success: false, message: 'Rack not found.' });
  }

  // Authorization check
  const userIdStr = req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  const isTeamLeader = rack.team && rack.team.teamLeader && rack.team.teamLeader.toString() === userIdStr;
  const isTeamMember = rack.team && rack.team.members && rack.team.members.some(m => m.toString() === userIdStr);

  if (!(isAdmin || isTeamLeader || isTeamMember)) {
    return res.status(403).json({ success: false, message: 'Not authorized to view this rack.' });
  }

  res.status(200).json({ success: true, data: rack });
});

//===========================================================================================================
// Update rack (only admin or team leader of assigned team)
//===========================================================================================================
exports.updateRack = asyncHandler(async (req, res) => {
  const rackId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(rackId)) {
    return res.status(400).json({ success: false, message: 'Invalid Rack ID.' });
  }

  // Find which collection contains this rack
  let rack = null;
  let RackModel = null;

  // Try TVS first
  rack = await TVSRack.findById(rackId).populate('team', 'teamLeader auditType');
  if (rack) {
    RackModel = TVSRack;
  } else {
    // Try TATA
    rack = await TATARack.findById(rackId).populate('team', 'teamLeader auditType');
    if (rack) {
      RackModel = TATARack;
    }
  }

  if (!rack) {
    return res.status(404).json({ success: false, message: 'Rack not found.' });
  }

  // Authorization check
  const userIdStr = req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  const isTeamLeader = rack.team && rack.team.teamLeader && rack.team.teamLeader.toString() === userIdStr;

  if (!(isAdmin || isTeamLeader)) {
    return res.status(403).json({ success: false, message: 'Not authorized to update this rack.' });
  }

  try {
    const updateData = { ...req.body };

    // Handle unsetting of fields
    if (updateData.mrp !== undefined && (updateData.mrp === null || updateData.mrp === '')) {
      updateData.$unset = { mrp: 1 };
      delete updateData.mrp;
    }
    if (updateData.ndp !== undefined && (updateData.ndp === null || updateData.ndp === '')) {
      updateData.$unset = { ...updateData.$unset, ndp: 1 };
      delete updateData.ndp;
    }

    const updatedRack = await RackModel.findByIdAndUpdate(rackId, updateData, {
      new: true,
      runValidators: true,
    }).populate('team', 'teamLeader');

    res.status(200).json({
      success: true,
      message: 'Rack updated successfully',
      data: updatedRack,
    });
  } catch (error) {
    console.error('Error updating rack:', error);
    res.status(500).json({ success: false, message: 'Server error updating rack.' });
  }
});

//===========================================================================================================
// Delete rack (only admin or team leader of assigned team)
//===========================================================================================================
exports.deleteRack = asyncHandler(async (req, res, next) => {
  const rackId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(rackId)) {
    return res.status(400).json({ success: false, message: 'Invalid Rack ID.' });
  }

  // Find which collection contains this rack
  let rack = null;
  let RackModel = null;

  // Try TVS first
  rack = await TVSRack.findById(rackId).populate('team', 'teamLeader');
  if (rack) {
    RackModel = TVSRack;
  } else {
    // Try TATA
    rack = await TATARack.findById(rackId).populate('team', 'teamLeader');
    if (rack) {
      RackModel = TATARack;
    }
  }

  if (!rack) {
    return res.status(404).json({ success: false, message: 'Rack not found.' });
  }

  // Authorization check
  const userIdStr = req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  const isTeamLeader = rack.team && rack.team.teamLeader && rack.team.teamLeader.toString() === userIdStr;

  if (!(isAdmin || isTeamLeader)) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this rack.' });
  }

  try {
    await RackModel.deleteOne({ _id: rackId });

    res.status(200).json({
      success: true,
      message: 'Rack deleted successfully',
      data: {},
    });
  } catch (error) {
    console.error('Error deleting rack:', error);
    res.status(500).json({ success: false, message: 'Server error deleting rack.' });
  }
});

//===========================================================================================================
// Get scan counts grouped by user for a specific team
//===========================================================================================================
exports.getScanCountsByUser = asyncHandler(async (req, res, next) => {
  const { teamId } = req.query;
  if (!teamId) {
    return res.status(400).json({ success: false, message: 'Team ID is required.' });
  }

  // Get team to determine auditType
  const team = await Team.findById(teamId);
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found.' });
  }

  const RackModel = getRackModel(team.auditType || 'TVS');

  const scanCounts = await RackModel.aggregate([
    { $match: { team: new mongoose.Types.ObjectId(teamId) } },
    { $group: { _id: '$scannedBy', count: { $sum: 1 } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'scannedByUser' } },
    {
      $project: {
        _id: 0,
        userName: { $arrayElemAt: ['$scannedByUser.name', 0] },
        count: 1
      }
    }
  ]);

  res.status(200).json({ success: true, data: scanCounts });
});

//===========================================================================================================
// Get first scan of each user for a specific team on a specific date
//===========================================================================================================
exports.getFirstScanByUser = async (req, res, next) => {
  try {
    const { teamId, date } = req.query;
    if (!teamId || !date) {
      return res.status(400).json({ error: 'teamId and date are required' });
    }

    // Get team to determine auditType
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const RackModel = getRackModel(team.auditType || 'TVS');
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const results = await RackModel.aggregate([
      {
        $match: {
          team: new mongoose.Types.ObjectId(teamId),
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        }
      },
      {
        $group: {
          _id: "$scannedBy",
          count: { $sum: 1 },
          firstScan: { $min: "$createdAt" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          user: "$user.name",
          count: 1,
          firstScan: 1
        }
      }
    ]);

    const data = {};
    for (const row of results) {
      data[row.user] = { count: row.count, firstScan: row.firstScan };
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
};

//===========================================================================================================
// Get the most recent rack by part number within a specific team (by siteName)
//===========================================================================================================
exports.getRackByPartNo = asyncHandler(async (req, res, next) => {
  const { siteName, partNo } = req.params;

  // 1. Find the team using the siteName
  const team = await Team.findOne({ siteName });
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found.' });
  }

  // 2. Get the correct rack model
  const RackModel = getRackModel(team.auditType || 'TVS');

  // 3. Find the most recent rack for that partNo WITHIN THAT TEAM
  const rack = await RackModel.findOne({
    partNo: partNo,
    team: team._id
  }).sort({ createdAt: -1 });

  if (!rack) {
    return res.status(404).json({ success: false, message: 'No existing rack found for this part number in this team.' });
  }

  res.status(200).json({ success: true, data: rack });
});

//===========================================================================================================
// Download racks as Excel - ULTRA FAST with cached data
//===========================================================================================================
exports.downloadRacksAsExcel = asyncHandler(async (req, res, next) => {
  const { teamId, search, date } = req.query;

  console.log('Starting FAST Excel download for team:', teamId);

  try {
    // Get team
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // Get the correct rack model - fallback to TVS if auditType is missing
    const RackModel = (team.auditType || 'TVS') === 'TVS' ? TVSRack : TATARack;

    // Build query
    const query = { team: new mongoose.Types.ObjectId(teamId) };

    if (search && search !== 'n/a' && search !== 'na') {
      query.$or = [
        { rackNo: { $regex: search, $options: 'i' } },
        { partNo: { $regex: search, $options: 'i' } },
      ];
    }

    if (date) {
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    console.log('Fetching racks with query:', JSON.stringify(query));

    // GET RACKS WITHOUT POPULATING - WE'LL DO A SINGLE MASTER DATA LOOKUP
    const racks = await RackModel.find(query)
      .sort({ createdAt: -1 })
      .populate('scannedBy', 'name')
      .lean();

    if (racks.length === 0) {
      return res.status(404).json({ success: false, message: 'No data found' });
    }

    console.log(`Found ${racks.length} racks`);

    // === FIX: Get ALL unique part numbers and fetch latest master data in ONE query ===
    const uniquePartNos = [...new Set(racks.map(rack => rack.partNo))];

    // Fetch latest master data for all part numbers
    const latestMasterData = await MasterDescription.find({
      partNo: { $in: uniquePartNos }
    }).lean();

    // Create a map for quick lookup
    const masterDataMap = {};
    latestMasterData.forEach(item => {
      masterDataMap[item.partNo] = item;
    });

    // Enrich racks with LATEST master data (not cached)
    const enrichedRacks = racks.map(rack => {
      const latestData = masterDataMap[rack.partNo];

      return {
        ...rack,
        // Use LATEST master data if available, otherwise fallback to cached
        mrp: latestData?.mrp || rack.cachedMRP || rack.mrp || 0,
        ndp: latestData?.ndp || rack.cachedNDP || rack.ndp || 0,
        materialDescription: latestData?.description || rack.cachedDescription || rack.materialDescription || '',
        scannedByName: rack.scannedBy?.name || 'Unknown',
        // Track data source for debugging (optional)
        dataSource: latestData ? 'live' : 'cached',
        timestamp: rack.createdAt ? new Date(rack.createdAt).toLocaleString('en-IN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        }) : ''
      };
    });

    // Filter for N/A search if needed
    let finalRacks = enrichedRacks;
    if (search && (search.toLowerCase() === 'n/a' || search.toLowerCase() === 'na')) {
      finalRacks = enrichedRacks.filter(rack =>
        !rack.mrp || !rack.ndp || !rack.materialDescription
      );
      console.log(`Filtered to ${finalRacks.length} racks with missing data`);
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PAS System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Racks');

    // Define columns based on audit type
    if (team.auditType === 'TVS') {
      sheet.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Site', key: 'site', width: 20 },
        { header: 'Location', key: 'location', width: 15 },
        { header: 'Rack No.', key: 'rackNo', width: 12 },
        { header: 'Part No.', key: 'partNo', width: 15 },
        { header: 'Quantity', key: 'qty', width: 10 },
        { header: 'MRP (₹)', key: 'mrp', width: 12 },
        { header: 'NDP (₹)', key: 'ndp', width: 12 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Scanned By', key: 'scannedBy', width: 20 },
        { header: 'Timestamp', key: 'timestamp', width: 20 }  // Added Timestamp at the end
      ];
    } else {
      // TATA format - NDP only, no MRP
      sheet.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Site', key: 'site', width: 20 },
        { header: 'Product Category', key: 'category', width: 15 },
        { header: 'Rack No.', key: 'rackNo', width: 12 },
        { header: 'Part No.', key: 'partNo', width: 15 },
        { header: 'Quantity', key: 'qty', width: 10 },
        { header: 'NDP (₹)', key: 'ndp', width: 12 },      // NDP only, no MRP
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Remark', key: 'remark', width: 15 },
        { header: 'Scanned By', key: 'scannedBy', width: 20 },
        { header: 'Timestamp', key: 'timestamp', width: 20 }  // Added Timestamp at the end
      ];
    }

    // Add rows
    finalRacks.forEach((rack, index) => {
      const rowData = {
        date: rack.createdAt ? new Date(rack.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        site: rack.siteName || team.siteName,
        rackNo: rack.rackNo || '',
        partNo: rack.partNo || '',
        qty: rack.nextQty || 0,
        description: rack.materialDescription || '',
        scannedBy: rack.scannedByName,
        timestamp: rack.timestamp  // Add timestamp to row data
      };

      if (team.auditType === 'TVS') {
        rowData.location = rack.location || '';
        rowData.mrp = rack.mrp || 0;
        rowData.ndp = rack.ndp || 0;
      } else {
        rowData.category = rack.location || '';
        rowData.ndp = rack.ndp || 0;  // NDP only for TATA
        rowData.remark = rack.remark || '';
        // No MRP field for TATA
      }

      sheet.addRow(rowData);
    });

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: team.auditType === 'TVS' ? 'FF004F98' : 'FFD35400' }
    };

    // Auto-fit columns (optional)
    sheet.columns.forEach(column => {
      if (column.key) {
        // Don't make columns too wide
        column.width = Math.min(column.width || 15, 50);
      }
    });

    // Add filter to header row
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount }
    };

    // Freeze header row
    sheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const dateStr = date ? new Date(date).toISOString().split('T')[0] : 'all';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${team.siteName.replace(/[^a-zA-Z0-9]/g, '_')}_racks_${dateStr}_${timestamp}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel download error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
