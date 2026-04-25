import mongoose from 'mongoose';

const conversationSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  intent: { type: String }, // schedule, reschedule, cancel, query, availability
  participants: [{ type: String }],
  date: { type: String },
  time: { type: String },
  timezone: { type: String },
  duration: { type: Number },
  title: { type: String },
  targetDate: { type: String },
  targetParticipant: { type: String },
  pendingParticipants: [{ type: String }],
  pendingResolutionName: { type: String },
  ambiguousCandidates: [{ type: String }],
  resolvedParticipants: [{ type: String }],
  awaitingConfirmation: { type: Boolean, default: false },
  awaitingTitle: { type: Boolean, default: false },
  awaitingParticipants: { type: Boolean, default: false },
  suggestedSlots: [{ type: String }],
  status: { type: String, enum: ['active', 'completed', 'canceled'], default: 'active' },
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
  messages: [{
    role: { type: String, enum: ['user', 'model'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

const ConversationSession = mongoose.model('ConversationSession', conversationSessionSchema);
export default ConversationSession;
