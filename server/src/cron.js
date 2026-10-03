import cron from 'node-cron';
import { runIngestion } from './services/ingestionService.js';

let cronTask = null;

export function initCronJobs() {
  console.log('[Cron] Initializing node-cron scheduler (Ingestion interval: every 10 minutes)...');

  // Schedule task every 10 minutes: */10 * * * *
  cronTask = cron.schedule('*/10 * * * *', async () => {
    console.log('[Cron] Triggering 10-minute scheduled feed ingestion job...');
    try {
      await runIngestion();
    } catch (err) {
      console.error('[Cron] Unhandled error in scheduled feed ingestion:', err);
    }
  });

  return cronTask;
}

export function stopCronJobs() {
  if (cronTask) {
    cronTask.stop();
    console.log('[Cron] Stopped background cron jobs.');
  }
}
