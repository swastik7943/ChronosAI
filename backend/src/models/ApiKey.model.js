import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastUsedAt: { type: Date }
}, {
  timestamps: true
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);
export default ApiKey;
