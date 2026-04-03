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
    const { bufferTime, timezone } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (bufferTime !== undefined) user.bufferTime = bufferTime;
    if (timezone) user.timezone = timezone;

    await user.save();
    
    res.json({ message: 'Settings updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
