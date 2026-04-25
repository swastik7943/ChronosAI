import Contact from '../models/Contact.model.js';
import User from '../models/User.model.js';

// Add a contact (by email of a registered user)
export const addContact = async (req, res) => {
  try {
    const { email, nickname, notes } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const contactUser = await User.findOne({ email });
    if (!contactUser) {
      return res.status(404).json({ message: 'No registered user found with that email. They must sign up first.' });
    }

    if (contactUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You can't add yourself as a contact" });
    }

    const existing = await Contact.findOne({ owner: req.user._id, contactUser: contactUser._id });
    if (existing) return res.status(400).json({ message: 'Contact already exists' });

    const contact = await Contact.create({
      owner: req.user._id,
      contactUser: contactUser._id,
      nickname: nickname || contactUser.name,
      notes: notes || ''
    });

    const populated = await Contact.findById(contact._id)
      .populate('contactUser', 'name email timezone');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all contacts for the logged-in user
export const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find({ owner: req.user._id })
      .populate('contactUser', 'name email timezone')
      .sort({ nickname: 1 });

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search contacts by name or email
export const searchContacts = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    // First, find users matching the search
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    }).select('_id');

    const userIds = matchingUsers.map(u => u._id);

    // Then find contacts that reference those users, or match nickname
    const contacts = await Contact.find({
      owner: req.user._id,
      $or: [
        { contactUser: { $in: userIds } },
        { nickname: { $regex: q, $options: 'i' } }
      ]
    }).populate('contactUser', 'name email timezone');

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search all registered users (for adding new contacts)
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    }).select('name email timezone').limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a contact (nickname/notes)
export const updateContact = async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, owner: req.user._id });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    if (req.body.nickname) contact.nickname = req.body.nickname;
    if (req.body.notes !== undefined) contact.notes = req.body.notes;
    await contact.save();

    const populated = await Contact.findById(contact._id)
      .populate('contactUser', 'name email timezone');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a contact
export const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    res.json({ message: 'Contact removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
