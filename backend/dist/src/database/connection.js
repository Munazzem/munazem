import mongoose from "mongoose";
import { envVars } from "../../config/env.service.js";
import { logger } from "../common/utils/logger.util.js";
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2_000; // 2s → 4s → 8s → 16s → 32s
export const DBConnection = async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await mongoose.connect(envVars.mongo_url, {
                maxPoolSize: 20, // Appropriate for KVM 2 VPS — prevents connection exhaustion
                minPoolSize: 2, // Keep 2 connections warm for fast first queries
                serverSelectionTimeoutMS: 10_000,
            });
            logger.info('db_connected', { message: 'Connected to MongoDB' });
            return;
        }
        catch (error) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            logger.error('db_connection_failed', {
                attempt,
                maxRetries: MAX_RETRIES,
                nextRetryMs: attempt < MAX_RETRIES ? delay : null,
                error: error.message,
            });
            if (attempt === MAX_RETRIES) {
                logger.error('db_fatal', {
                    message: `Failed to connect to MongoDB after ${MAX_RETRIES} attempts. Shutting down.`,
                });
                process.exit(1);
            }
            // Wait before next retry (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
};
//# sourceMappingURL=connection.js.map