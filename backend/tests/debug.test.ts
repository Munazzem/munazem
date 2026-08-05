import { describe, it, expect } from 'vitest';
import { getTestApp } from './tests/helpers/app.helper.js';
import { seedTeacher } from './tests/helpers/db.helper.js';
import { PasswordUtil } from './src/common/utils/password.util.js';
import { UserModel } from './src/database/models/user.model.js';

describe('Debug Login', () => {
    it('debugs login', async () => {
        const hashed = await PasswordUtil.hashPassword('testPass123');
        const user = await seedTeacher({ password: hashed });
        console.log('--- DB USER ---');
        console.log(await UserModel.findById(user._id).select('+password').lean());

        const app = getTestApp();
        const res = await app.post('/auth/login').send({
            phone: '01000000001',
            password: 'testPass123'
        });
        console.log('--- RESPONSE ---');
        console.log(res.status, res.body);
    });
});
