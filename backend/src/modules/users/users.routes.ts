import { Router } from 'express';
import { UserController } from './users.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all user routes globally by applying the middleware to the router
router.use(authenticate);

// Only authenticated users can create other users (e.g. SuperAdmin creating Teachers)
router.post('/', UserController.createUser);

export default router;
