import mongoose from 'mongoose';

const conversationSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  intent: { type: String }, // schedule, reschedule, cancel
  participants: [{ type: String }],
  date: { type: String },
  time: { type: String },
  timezone: { type: String },
  duration: { type: Number },
  targetDate: { type: String },
  targetParticipant: { type: String },
  pendingResolutionName: { type: String },
  ambiguousCandidates: [{ type: String }],
  resolvedParticipants: [{ type: String }],
  status: { type: String, enum: ['active', 'completed', 'canceled'], default: 'active' },
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' } // if rescheduling/canceling
}, {
  timestamps: true
});

const ConversationSession = mongoose.model('ConversationSession', conversationSessionSchema);
export default ConversationSession;
