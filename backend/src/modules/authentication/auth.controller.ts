import{Router} from 'express';
import { signup } from './auth.serivce.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';

const router = Router()

router.post('/signup', async(req, res) => {
    const userData = await signup(req.body)
    if (!userData) {
        res.status(400).json({message: "Failed to create user"})
    }
    SuccessResponse({ res, message: "User created successfully", data: userData })
})

export default router;