import ApiKey from '../models/ApiKey.model.js';
import User from '../models/User.model.js';

// Middleware to authenticate via API key (x-api-key header)
// Can be used as an alternative to JWT Bearer token for third-party integrations
export const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next(); // No API key, let other auth middleware handle it
  }

  try {
    const keyDoc = await ApiKey.findOne({ key: apiKey, isActive: true });
    if (!keyDoc) {
      return res.status(401).json({ message: 'Invalid or revoked API key' });
    }

    // Update last used timestamp
    keyDoc.lastUsedAt = new Date();
    await keyDoc.save();

    // Attach user to request
    const user = await User.findById(keyDoc.user).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'API key owner not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'API key authentication failed' });
  }
};
