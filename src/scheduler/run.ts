import { schedulerService } from './schedulerService';
import { logger } from '../logger/logger';

schedulerService.start();
logger.info('scheduler started');

process.on('SIGTERM', () => {
  schedulerService.stop();
  process.exit(0);
});
