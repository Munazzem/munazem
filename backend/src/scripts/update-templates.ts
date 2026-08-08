import mongoose from 'mongoose';
import { PlatformSettingsModel } from '../database/models/platform-settings.model.js';
import { envVars } from '../../config/env.service.js';
import { cache } from '../infrastructure/cache/cache.service.js';
import {
    DEFAULT_SESSION_ABSENT_TEMPLATES,
    DEFAULT_EXAM_RESULT_TEMPLATES
} from '../infrastructure/queues/whatsapp.templates.js';

async function run() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(envVars.mongo_url as string);
        console.log('Connected.');

        console.log('Updating whatsapp_templates...');
        
        const doc = await PlatformSettingsModel.findOne({ key: 'whatsapp_templates' });
        if (doc) {
            doc.value = {
                session_absent: DEFAULT_SESSION_ABSENT_TEMPLATES,
                exam_result: DEFAULT_EXAM_RESULT_TEMPLATES,
            };
            await doc.save();
            await cache.del('whatsapp_dynamic_templates');
            console.log('Successfully updated whatsapp_templates in the database and cleared cache.');
        } else {
            await PlatformSettingsModel.create({
                key: 'whatsapp_templates',
                value: {
                    session_absent: DEFAULT_SESSION_ABSENT_TEMPLATES,
                    exam_result: DEFAULT_EXAM_RESULT_TEMPLATES,
                }
            });
            await cache.del('whatsapp_dynamic_templates');
            console.log('Successfully created whatsapp_templates in the database and cleared cache.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

run();
