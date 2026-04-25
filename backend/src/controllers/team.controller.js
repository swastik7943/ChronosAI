import Team from '../models/Team.model.js';
import User from '../models/User.model.js';
import Meeting from '../models/Meeting.model.js';
import { v4 as uuidv4 } from 'uuid';

// Create a new workspace/team
export const createTeam = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Team name is required' });

    const team = await Team.create({
      name,
      description: description || '',
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }],
      inviteCode: uuidv4().slice(0, 8).toUpperCase()
    });

    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all teams the user belongs to
export const getMyTeams = async (req, res) => {
  try {
    const teams = await Team.find({ 'members.user': req.user._id })
      .populate('owner', 'name email')
      .populate('members.user', 'name email');
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single team by ID
export const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email timezone');

    if (!team) return res.status(404).json({ message: 'Team not found' });

    const isMember = team.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not a member of this team' });

    res.json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a member to team (by email)
export const addMember = async (req, res) => {
  try {
    const { email, role } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Only owner/admin can add
    const requester = team.members.find(m => m.user.toString() === req.user._id.toString());
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    const userToAdd = await User.findOne({ email });
    if (!userToAdd) return res.status(404).json({ message: 'User not found. They must register first.' });

    const alreadyMember = team.members.some(m => m.user.toString() === userToAdd._id.toString());
    if (alreadyMember) return res.status(400).json({ message: 'User is already a member' });

    team.members.push({ user: userToAdd._id, role: role || 'member' });
    await team.save();

    const updated = await Team.findById(team._id)
      .populate('members.user', 'name email');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove a member
export const removeMember = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const requester = team.members.find(m => m.user.toString() === req.user._id.toString());
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    if (req.params.userId === team.owner.toString()) {
      return res.status(400).json({ message: 'Cannot remove the workspace owner' });
    }

    team.members = team.members.filter(m => m.user.toString() !== req.params.userId);
    await team.save();

    res.json({ message: 'Member removed', team });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Join team via invite code
export const joinByInviteCode = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const team = await Team.findOne({ inviteCode });
    if (!team) return res.status(404).json({ message: 'Invalid invite code' });

    const alreadyMember = team.members.some(m => m.user.toString() === req.user._id.toString());
    if (alreadyMember) return res.status(400).json({ message: 'You are already a member' });

    team.members.push({ user: req.user._id, role: 'member' });
    await team.save();

    res.json({ message: 'Joined workspace successfully', team });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get shared calendar (all meetings from team members for a given date)
export const getTeamCalendar = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).populate('members.user', 'email');
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const isMember = team.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not a member' });

    const { date } = req.query;
    const memberIds = team.members.map(m => m.user._id);
    const memberEmails = team.members.map(m => m.user.email);

    const query = {
      status: 'scheduled',
      $or: [
        { organizer: { $in: memberIds } },
        { participants: { $in: memberEmails } }
      ]
    };
    if (date) query.date = date;

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email')
      .sort({ date: 1, startTime: 1 });

    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update team details
export const updateTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (team.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can update team details' });
    }

    if (req.body.name) team.name = req.body.name;
    if (req.body.description !== undefined) team.description = req.body.description;
    await team.save();

    res.json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete team
export const deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (team.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete the workspace' });
    }

    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
