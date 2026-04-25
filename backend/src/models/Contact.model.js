import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nickname: { type: String },
  notes: { type: String, default: '' }
}, {
  timestamps: true
});

// Prevent duplicate contacts
contactSchema.index({ owner: 1, contactUser: 1 }, { unique: true });

const Contact = mongoose.model('Contact', contactSchema);
export default Contact;
