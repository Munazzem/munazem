import { Queue } from 'bullmq';
import { envVars } from './config/env.service.js';
async function retryFailedJobs() {
    console.log('Connecting to Redis:', envVars.redisUrl);
    const queue = new Queue('whatsapp', { connection: { url: envVars.redisUrl } });
    const failedJobs = await queue.getFailed();
    console.log(`Found ${failedJobs.length} failed WhatsApp jobs.`);
    if (failedJobs.length === 0) {
        console.log('No failed jobs to retry.');
    }
    else {
        for (const job of failedJobs) {
            console.log(`Retrying job ID: ${job.id}`);
            await job.retry();
        }
        console.log('Successfully moved failed jobs back to the waiting queue!');
    }
    process.exit(0);
}
retryFailedJobs().catch(console.error);
//# sourceMappingURL=retry-failed.js.map