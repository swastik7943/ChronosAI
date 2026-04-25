import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  createTeam, getMyTeams, getTeamById,
  addMember, removeMember, joinByInviteCode,
  getTeamCalendar, updateTeam, deleteTeam
} from '../controllers/team.controller.js';

const router = express.Router();
router.use(protect);

router.post('/', createTeam);
router.get('/', getMyTeams);
router.post('/join', joinByInviteCode);
router.get('/:id', getTeamById);
router.put('/:id', updateTeam);
router.delete('/:id', deleteTeam);
router.post('/:id/members', addMember);
router.delete('/:id/members/:userId', removeMember);
router.get('/:id/calendar', getTeamCalendar);

export default router;
