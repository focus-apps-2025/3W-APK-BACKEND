// backend/controllers/teamController.js
const Team = require('../models/Team');
const User = require('../models/User');

// Helper function: Is the user admin or leader of this team?
const isTeamLeaderOrAdmin = (req, team) => {
  return (
    req.user.role === 'admin' ||
    (req.user.role === 'team_leader' && team.teamLeader && team.teamLeader.toString() === req.user._id.toString())
  );
};

//===========================================================================================================
// Create a new team.// @route   POST /api/teams,// @access  Private (Admin/Team Leader)
//===========================================================================================================
exports.createTeam = async (req, res) => {
  const { siteName, location, description, auditType, members, leader } = req.body;
  const currentUserRole = req.user.role;
  const currentUserId = req.user._id;
  
  if (!siteName || !location) {
    return res.status(400).json({ success: false, message: "Site Name and Location are required" });
  }

  // Validate auditType
  if (!auditType || !['TVS', 'TATA'].includes(auditType)) {
    return res.status(400).json({ success: false, message: "Valid audit type (TVS or TATA) is required" });
  }

  // Validate leader and members based on roles
  try {
    let teamLeaderId = leader;

    if (currentUserRole === 'admin') {
      if (!teamLeaderId) {
        return res.status(400).json({ success: false, message: 'Admin must explicitly select a team leader.' });
      }
      const specifiedLeader = await User.findById(teamLeaderId);
      if (
        !specifiedLeader ||
        (specifiedLeader.role !== 'team_leader' && specifiedLeader.role !== 'admin')
      ) {
        return res.status(400).json({ success: false, message: 'Provided leader ID is invalid or not a team leader/admin.' });
      }
    } else if (currentUserRole === 'team_leader') {
      if (teamLeaderId && teamLeaderId.toString() !== currentUserId.toString()) {
        return res.status(403).json({ success: false, message: 'Team leaders can only create teams with themselves as the leader.' });
      }
      teamLeaderId = currentUserId;
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized to create teams.' });
    }

    // Validate members
    if (members && members.length > 0) {
      const memberUsers = await User.find({ _id: { $in: members } });
      if (memberUsers.length !== members.length) {
        return res.status(400).json({ success: false, message: "One or more provided member IDs are invalid." });
      }
      const invalidRoleMembers = memberUsers.filter(user => user.role !== 'team_member');
      if (invalidRoleMembers.length > 0) {
        return res.status(400).json({ success: false, message: "Only users with the 'team_member' role can be added to a team." });
      }
    }

    // Create and save the new team
    const team = new Team({
      siteName,
      location,
      description,
      auditType,
      teamLeader: teamLeaderId,
      members: members || [],
      status: 'Active'
    });

    const savedTeam = await team.save();
    // Populate leader and members for response
    const populatedTeam = await Team.findById(savedTeam._id)
      .populate('teamLeader', 'name email role')
      .populate('members', 'name email role');

    res.status(201).json({ success: true, message: "Team created successfully", team: populatedTeam });
  } catch (error) {
    console.error("Error creating team:", error);
    res.status(500).json({ success: false, message: "Server error creating team" });
  }
};

//===========================================================================================================
// Get all teams.// @route   GET /api/teams,// @access  Private
//===========================================================================================================
exports.getTeams = async (req, res) => {
  try {
    let teams;

    if (req.user.role === 'admin') {
      // Admin: retrieve all teams regardless of status
      teams = await Team.find({})
        .populate('teamLeader', 'name email role')
        .populate('members', 'name email role')
        .sort({ createdAt: -1 });
    } else {
      // Non-admin (team leaders and others): only teams they lead
      teams = await Team.find({ teamLeader: req.user._id, status: 'Active' })
        .populate('teamLeader', 'name email role')
        .populate('members', 'name email role')
        .sort({ createdAt: -1 });
    }

    res.status(200).json({ success: true, teams });
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({ success: false, message: "Server error fetching teams" });
  }
};

//===========================================================================================================
// Get a team by ID.// @route   GET /api/teams/:id,// @access  Private
//===========================================================================================================
exports.getTeamById = async (req, res) => {
  // Only team leader or admin can view
  try {
    const team = await Team.findById(req.params.id)
      .populate('teamLeader', 'name email role')
      .populate('members', 'name email role');
    
    // Check if team exists
    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    // Authorization check
    if (!isTeamLeaderOrAdmin(req, team)) {
      return res.status(403).json({ success: false, message: "Not authorized to view this team" });
    }

    res.status(200).json({ success: true, team });
  } catch (error) {
    console.error("Error fetching team:", error);
    res.status(500).json({ success: false, message: "Server error fetching team" });
  }
};

//===========================================================================================================
// Get teams for a specific member.// @route   GET /api/teams/member/:memberId,// @access  Private (Member for self; admin/team leader for anyone)
//===========================================================================================================
exports.getTeamsForMember = async (req, res) => {
  // Only the member themselves, admin, or team leaders can view
  const memberId = req.params.memberId;
  if (
    req.user._id.toString() !== memberId &&
    req.user.role !== 'admin' &&
    req.user.role !== 'team_leader'
  ) {
    return res.status(403).json({ success: false, message: "Not authorized to view these teams for another user." });
  }

  // Fetch teams where this user is a member and the team is active
  try {
    const teams = await Team.find({
      members: memberId, 
      status: 'Active'
    })
      .populate('teamLeader', 'name email')
      .populate('members', 'name email');
    
    res.status(200).json({ success: true, teams });
  } catch (error) {
    console.error("Error fetching teams for member:", error);
    res.status(500).json({ success: false, message: "Server error fetching teams for member" });
  }
};

//===========================================================================================================
// Get teams by team leader ID.// @route   GET /api/teams/leader/:leaderId,// @access  Private (Leader for self; admin for anyone)
//===========================================================================================================
exports.getTeamsByLeaderId = async (req, res) => {
  // Only the team leader themselves or admin can view
  const leaderId = req.params.leaderId;
  if (req.user.role !== 'admin' && req.user._id.toString() !== leaderId) {
    return res.status(403).json({ success: false, message: "Not authorized to view teams for this leader ID." });
  }

  // Fetch teams led by this leader
  try {
    const teams = await Team.find({ teamLeader: leaderId })
      .populate('teamLeader', 'name email role')
      .populate('members', 'name email role');
    
    res.status(200).json({ success: true, teams });
  } catch (error) {
    console.error("Error fetching teams by leader ID:", error);
    res.status(500).json({ success: false, message: "Server error fetching teams by leader ID" });
  }
};

//===========================================================================================================
// Update a team.// @route   PUT /api/teams/:id,// @access  Private (Admin/Team Leader for this team)
//===========================================================================================================
exports.updateTeam = async (req, res) => {
  // Only team leader of this team or admin can update
  const { siteName, location, description, auditType, members, status } = req.body;
  
  // Validate required fields
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: "Team not found" });

    if (req.user.role !== 'admin' && team.teamLeader.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to update this team." });
    }

    // Validate auditType if provided
    if (auditType && !['TVS', 'TATA'].includes(auditType)) {
      return res.status(400).json({ success: false, message: "Valid audit type (TVS or TATA) is required" });
    }

    if (members && members.length > 0) {
      const memberUsers = await User.find({ _id: { $in: members } });
      if (memberUsers.length !== members.length) {
        return res.status(400).json({ success: false, message: "One or more provided member IDs are invalid." });
      }
      const invalidRoleMembers = memberUsers.filter(user => user.role !== 'team_member');
      if (invalidRoleMembers.length > 0) {
        return res.status(400).json({ success: false, message: "Only users with the 'team_member' role can be added to a team." });
      }
    }

    // Update fields if provided
    team.siteName = siteName || team.siteName;
    team.location = location || team.location;
    team.description = description !== undefined ? description : team.description;
    team.auditType = auditType || team.auditType;
    team.members = members || team.members;
    team.status = status || team.status;

    const updatedTeam = await team.save();
    
    // Populate leader and members for response
    const populatedTeam = await Team.findById(updatedTeam._id)
      .populate('teamLeader', 'name email role')
      .populate('members', 'name email role');
    
    res.status(200).json({ success: true, message: "Team updated successfully", team: populatedTeam });
  } catch (error) {
    console.error("Error updating team:", error);
    res.status(500).json({ success: false, message: "Server error updating team" });
  }
};

//===========================================================================================================
// Delete a team.// @route   DELETE /api/teams/:id,// @access  Private (Admin/Team Leader for this team)
//===========================================================================================================
exports.deleteTeam = async (req, res) => {
  // Only team leader of this team or admin can delete
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: "Team not found" });
    
    if (!isTeamLeaderOrAdmin(req, team)) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this team" });
    }
    
    await team.deleteOne();
    res.status(200).json({ success: true, message: "Team deleted successfully" });
  } catch (error) {
    console.error("Error deleting team:", error);
    res.status(500).json({ success: false, message: "Server error deleting team" });
  }
};

//===========================================================================================================
// Add a member to a team.// @route   PUT /api/teams/:id/add-member,// @access  Private (Admin/Team Leader for this team)
//===========================================================================================================
exports.addTeamMember = async (req, res) => {
  // Only team leader of this team or admin can add members
  const { memberId } = req.body;
  
  // Validate memberId
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: "Team not found" });
    
    if (!isTeamLeaderOrAdmin(req, team)) {
      return res.status(403).json({ success: false, message: "Not authorized to modify this team" });
    }
    
    const memberUser = await User.findById(memberId);
    if (!memberUser) return res.status(404).json({ success: false, message: "Member user not found" });
    
    if (memberUser.role !== 'team_member') {
      return res.status(400).json({ success: false, message: "Only Team Members can be added to a team." });
    }

    // New check: prevent member assignment if they're on another active team
    const activeTeam = await Team.findOne({
      members: memberId,
      status: 'Active',
      _id: { $ne: team._id } // Exclude the current team (for updates)
    });
    
    if (activeTeam) {
      return res.status(400).json({
        success: false,
        message: "User is already a member of another active team."
      });
    }

    if (team.members.includes(memberId)) {
      return res.status(400).json({ success: false, message: "User is already a member of this team." });
    }
    
    team.members.push(memberId);
    await team.save();
    
    const populatedTeam = await Team.findById(team._id)
      .populate('teamLeader', 'name email role')
      .populate('members', 'name email role');
    
    res.status(200).json({ success: true, message: "Member added successfully", team: populatedTeam });
  } catch (error) {
    console.error("Error adding member:", error);
    res.status(500).json({ success: false, message: "Server error adding member" });
  }
};

//===========================================================================================================
// Remove a member from a team.// @route   PUT /api/teams/:id/remove-member,// @access  Private (Admin/Team Leader for this team)
//===========================================================================================================
exports.removeTeamMember = async (req, res) => {
  // Only team leader of this team or admin can remove members
  const { memberId } = req.body;
  
  try {
    const team = await Team.findById(req.params.id);
    
    // Check if team exists
    if (!team) return res.status(404).json({ success: false, message: "Team not found" });
    
    if (!isTeamLeaderOrAdmin(req, team)) {
      return res.status(403).json({ success: false, message: "Not authorized to modify this team" });
    }
    
    // Check if member exists in team
    const initialLength = team.members.length;
    team.members = team.members.filter(member => member.toString() !== memberId);
    
    if (team.members.length === initialLength) {
      return res.status(400).json({ success: false, message: "User is not a member of this team." });
    }
    
    await team.save();
    
    // Populate leader and members for response
    const populatedTeam = await Team.findById(team._id)
      .populate('teamLeader', 'name email role')
      .populate('members', 'name email role');
    
    res.status(200).json({ success: true, message: "Member removed successfully", team: populatedTeam });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ success: false, message: "Server error removing member" });
  }
};

//======================================================================================================================================================================
// Complete team work: clear members and leader, set status to 'completed'.// @route   PUT /api/teams/:id/complete,// @access  Private (Admin/Team Leader for this team)
//======================================================================================================================================================================
exports.completeTeamWork = async (req, res) => {
  // Only team leader of this team or admin can complete work
  try {
    const teamId = req.params.id;
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ success: false, message: `Team not found with ID of ${teamId}` });
    }
    
    // Authorization check
    const isAuthorized =
      req.user.role === 'admin' ||
      (req.user.role === 'team_leader' && team.teamLeader && team.teamLeader.toString() === req.user._id.toString());
    
    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Not authorized to complete work for this team.' });
    }
    
    team.members = [];
    team.teamLeader = null;
    team.status = 'Completed';

    await team.save();

    res.status(200).json({
      success: true,
      message: `Team '${team.siteName}' work completed. Members and leader cleared, status set to 'completed'.`,
      data: team
    });
  } catch (error) {
    console.error("Error completing team work:", error);
    res.status(500).json({ success: false, message: "Server error completing team work" });
  }
};

//================================================================================================================================
// Get team work status (if completed).// @route   GET /api/teams/:id/status,// @access  Private (Admin/Team Leader for this team)
//================================================================================================================================
exports.getTeamWorkStatus = async (req, res, next) => {
  // Only team leader of this team or admin can view status
  try {
    const team = await Team.findById(req.params.id);
    
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }
    
    const isSubmitted = team.status === 'Completed';
    res.status(200).json({ success: true, isSubmitted });
  } catch (err) {
    next(err);
  }
};

