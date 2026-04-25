import User from '../models/User.model.js';

export const getUserSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateUserSettings = async (req, res) => {
  try {
    const { name, avatar, bufferTime, timezone, workingHoursStart, workingHoursEnd, breakStart, breakEnd, offDays } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (avatar) user.avatar = avatar;
    if (bufferTime !== undefined) user.bufferTime = bufferTime;
    if (timezone) user.timezone = timezone;
    if (workingHoursStart) user.workingHoursStart = workingHoursStart;
    if (workingHoursEnd) user.workingHoursEnd = workingHoursEnd;
    if (breakStart !== undefined) user.breakStart = breakStart;
    if (breakEnd !== undefined) user.breakEnd = breakEnd;
    if (offDays !== undefined) {
      // Validate: must be an array of numbers 0–6
      if (Array.isArray(offDays) && offDays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
        user.offDays = offDays;
      }
    }

    await user.save();
    
    res.json({ message: 'Settings updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const disconnectGoogle = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.googleId = undefined;
    user.googleAccessToken = undefined;
    user.googleRefreshToken = undefined;
    
    await user.save();
    res.json({ message: 'Google account disconnected successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
