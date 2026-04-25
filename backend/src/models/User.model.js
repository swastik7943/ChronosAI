import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false }, // Made optional for OAuth users
  timezone: { type: String, default: 'UTC' },
  bufferTime: { type: Number, default: 0 },
  workingHoursStart: { type: String, default: '09:00' }, // HH:mm format
  workingHoursEnd: { type: String, default: '18:00' },
  breakStart: { type: String, default: '13:00' },
  breakEnd: { type: String, default: '14:00' },
  offDays: { type: [Number], default: [0] }, // 0=Sunday, 1=Monday, ..., 6=Saturday
  googleId: { type: String },
  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
  avatar: { type: String } // Base64 or URL
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
