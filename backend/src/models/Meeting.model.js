import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  startTime: { type: String, required: true }, // HH:mm
  duration: { type: Number, required: true }, // in minutes
  participants: [{ type: String }],
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jitsiRoom: { type: String }, // specific room id or name for this meeting
  status: { type: String, enum: ['scheduled', 'canceled'], default: 'scheduled' }
}, {
  timestamps: true
});

const Meeting = mongoose.model('Meeting', meetingSchema);
export default Meeting;
