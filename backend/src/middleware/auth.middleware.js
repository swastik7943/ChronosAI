import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import ApiKey from '../models/ApiKey.model.js';

export const protect = async (req, res, next) => {
  // If already authenticated via API key middleware, skip
  if (req.user) return next();

  // Try API key first (x-api-key header)
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    try {
      const keyDoc = await ApiKey.findOne({ key: apiKey, isActive: true });
      if (keyDoc) {
        keyDoc.lastUsedAt = new Date();
        await keyDoc.save();
        req.user = await User.findById(keyDoc.user).select('-password');
        if (req.user) return next();
      }
    } catch (err) {
      // Fall through to JWT auth
    }
  }

  // Try HttpOnly Cookie then fallback to Bearer
  let token = req.cookies?.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_chronosai');
      req.user = await User.findById(decoded.id).select('-password');
      if (req.user) return next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token or API key provided' });
};
