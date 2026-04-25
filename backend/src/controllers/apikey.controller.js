import ApiKey from '../models/ApiKey.model.js';
import { v4 as uuidv4 } from 'uuid';

// Generate a new API key
export const createApiKey = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'API key name is required' });

    const key = `cai_${uuidv4().replace(/-/g, '')}`;

    const apiKey = await ApiKey.create({
      user: req.user._id,
      key,
      name
    });

    // Only show the full key on creation
    res.status(201).json({
      _id: apiKey._id,
      name: apiKey.name,
      key: apiKey.key, // Full key shown once
      createdAt: apiKey.createdAt,
      message: 'Save this key securely. It will not be shown again in full.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// List API keys (masked)
export const getApiKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find({ user: req.user._id }).select('-key');
    res.json(keys);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Revoke an API key
export const revokeApiKey = async (req, res) => {
  try {
    const apiKey = await ApiKey.findOne({ _id: req.params.id, user: req.user._id });
    if (!apiKey) return res.status(404).json({ message: 'API key not found' });

    apiKey.isActive = false;
    await apiKey.save();

    res.json({ message: 'API key revoked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete an API key
export const deleteApiKey = async (req, res) => {
  try {
    const result = await ApiKey.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!result) return res.status(404).json({ message: 'API key not found' });
    res.json({ message: 'API key deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
