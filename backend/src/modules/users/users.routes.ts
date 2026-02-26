import { Router } from 'express';
import { UserController } from './users.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { UserRole } from '../../common/enums/enum.service.js';

const router = Router();

// Protect all user routes globally by applying the middleware to the router
router.use(authenticate);

// Only SuperAdmin and Teacher can create new users (Teacher creates Assistant, SuperAdmin creates Teacher)
router.post('/', authorizeRoles(UserRole.superAdmin, UserRole.teacher), UserController.createUser);

export default router;
