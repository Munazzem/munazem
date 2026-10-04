/**
 * tests/integration/centers-onboarding.api.test.ts
 *
 * Integration tests for SuperAdmin Center Onboarding and Tenant listing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeSuperAdminToken, makeTeacherToken, bearerHeader, TEST_IDS } from '../helpers/auth.helper.js';
import { seedSuperAdmin, seedTeacher } from '../helpers/db.helper.js';
import { UserModel } from '../../src/database/models/user.model.js';
import { CenterModel } from '../../src/database/models/center.model.js';
import { SubscriptionModel } from '../../src/database/models/subscription.model.js';
import { UserRole } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

describe('Center Onboarding by SuperAdmin', () => {

    it('SuperAdmin can onboard a new center and centerOwner successfully', async () => {
        await seedSuperAdmin();

        const payload = {
            centerName: 'سنتر الأوائل التعليمي',
            ownerName: 'أحمد محمود النجار',
            phone: '01099887766',
            password: 'secretPassword123',
            email: 'al-awaael@center.com',
            address: 'القاهرة - المعادي',
            centerPhone: '01122334455',
        };

        const res = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.data.center).toBeDefined();
        expect(res.body.data.center.name).toBe(payload.centerName);
        expect(res.body.data.owner).toBeDefined();
        expect(res.body.data.owner.phone).toBe(payload.phone);
        expect(res.body.data.owner.role).toBe(UserRole.centerOwner);

        // Verify in DB
        const createdUser = await UserModel.findOne({ phone: payload.phone }).lean();
        expect(createdUser).not.toBeNull();
        expect(createdUser?.role).toBe(UserRole.centerOwner);
        expect(createdUser?.centerId).toBeDefined();

        const createdCenter = await CenterModel.findById(createdUser?.centerId).lean();
        expect(createdCenter).not.toBeNull();
        expect(createdCenter?.name).toBe(payload.centerName);
        expect(createdCenter?.ownerId.toString()).toBe(createdUser?._id.toString());
        expect(createdCenter?.parentCenterId).toBeNull();

        // Verify default subscription was created
        const sub = await SubscriptionModel.findOne({ teacherId: createdUser?._id }).lean();
        expect(sub).not.toBeNull();
        expect(sub?.status).toBe('ACTIVE');
    });

    it('Returns 400 if phone is already registered', async () => {
        await seedSuperAdmin();
        await seedTeacher(); // uses phone: '01000000001'

        const payload = {
            centerName: 'سنتر النور',
            ownerName: 'محمد علي',
            phone: '01000000001', // duplicate phone
            password: 'password123',
        };

        const res = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('مسجل بالفعل');
    });

    it('Returns 403 if a Teacher tries to onboard a center', async () => {
        await seedTeacher();

        const res = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                centerName: 'سنتر تجريبي',
                ownerName: 'محمود سامي',
                phone: '01099998888',
                password: 'password123',
            });

        expect(res.status).toBe(403);
    });

    it('GET /admin/tenants returns both teachers and centers with correct role and centerName', async () => {
        await seedSuperAdmin();
        await seedTeacher();

        // Onboard a center
        await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send({
                centerName: 'سنتر الإبداع',
                ownerName: 'عصام كمال',
                phone: '01077776666',
                password: 'password123',
            });

        // Fetch tenants
        const res = await app
            .get('/admin/tenants')
            .set('Authorization', bearerHeader(makeSuperAdminToken()));

        expect(res.status).toBe(200);
        const tenants = res.body.data?.data || res.body.data;
        expect(tenants.length).toBeGreaterThanOrEqual(2);

        const centerTenant = tenants.find((t: any) => t.role === UserRole.centerOwner);
        expect(centerTenant).toBeDefined();
        expect(centerTenant.centerName).toBe('سنتر الإبداع');
        expect(centerTenant.name).toBe('عصام كمال');

        // Test filtering by role=centerOwner
        const centerOnlyRes = await app
            .get('/admin/tenants?role=centerOwner')
            .set('Authorization', bearerHeader(makeSuperAdminToken()));

        expect(centerOnlyRes.status).toBe(200);
        const centerOnlyTenants = centerOnlyRes.body.data?.data || centerOnlyRes.body.data;
        expect(centerOnlyTenants.every((t: any) => t.role === UserRole.centerOwner)).toBe(true);
    });
});
