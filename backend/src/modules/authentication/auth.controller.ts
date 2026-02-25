import { Router } from 'express';
import { signup, login, refreshTokens } from './auth.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { loginSchema, signupSchema } from './auth.validation.js';

const router = Router()

router.post('/signup', validate(signupSchema), async (req, res, next) => {
    try {
        const userData = await signup(req.body)
        if (!userData) {
            return res.status(400).json({message: "Failed to create user"})
        }
        SuccessResponse({ res, message: "User created successfully", data: userData })
    } catch (error) {
        next(error)
    }
})

router.post('/login', validate(loginSchema), async (req, res, next) => {
    try {
        const result = await login(req.body);
        SuccessResponse({ res, message: result.message, data: { token: result.token, refreshToken: result.refreshToken, user: result.user } })
    } catch (error) {
        next(error);
    }
})

router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const result = await refreshTokens(refreshToken);
        SuccessResponse({ res, message: 'Tokens refreshed successfully', data: result });
    } catch (error) {
        next(error);
    }
});

export default router;