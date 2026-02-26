import mongoose from 'mongoose';
import { UserModel } from './src/database/models/user.model.js';
import { PasswordUtil } from './src/common/utils/password.util.js';
import { UserRole } from './src/common/enums/enum.service.js';
import { envVars } from './config/env.service.js';

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(envVars.mongo_url as string);
    console.log('🔗 Connected to DB for seeding...');

    const superAdminExists = await UserModel.findOne({ role: UserRole.superAdmin });

    if (superAdminExists) {
      console.log('SuperAdmin already exists in the database. Exiting...');
      process.exit(0);
    }

    const hashedPassword = await PasswordUtil.hashPassword('admin123456');

    await UserModel.create({
      name: 'المدير العام',
      email: 'admin@monazem.com',
      phone: '01000000000',
      password: hashedPassword,
      role: UserRole.superAdmin,
      isActive: true,
    });

    console.log('SuperAdmin created successfully!');
    console.log(' Phone: 01000000000');
    console.log('Password: admin123456');

  } catch (error) {
    console.error('Error seeding SuperAdmin:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedSuperAdmin();
