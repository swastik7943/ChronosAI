import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  addContact, getContacts, searchContacts,
  searchUsers, updateContact, deleteContact
} from '../controllers/contact.controller.js';

const router = express.Router();
router.use(protect);

router.post('/', addContact);
router.get('/', getContacts);
router.get('/search', searchContacts);
router.get('/users', searchUsers);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;
