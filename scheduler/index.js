/**
 * Scheduled-scan service (docker-compose `scheduler`). Every TICK_SECONDS it runs
 * the jobs that are due (scheduler/runner.js) and touches a heartbeat file for the
 * container healthcheck.
 *
 *   API_BASE_URL                 http://api-gateway:1001
 *   WORKER_ID                    this container's hostname
 *   TICK_SECONDS                 30
 *   SCHEDULER_DEFAULT_TIME_ZONE  UTC (jobs saved before time zones were recorded)
 */
import { writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { configureScanApi } from '../src/lib/scanApi';
import { runDueJobs } from './runner';

const baseUrl = process.env.API_BASE_URL || 'http://api-gateway:1001';
const workerId = (process.env.WORKER_ID || `scheduler-${hostname()}`).replace(/[^A-Za-z0-9_.:@|-]/g, '-');
const tickMs = Number(process.env.TICK_SECONDS || 30) * 1000;
const defaultTimeZone = process.env.SCHEDULER_DEFAULT_TIME_ZONE || 'UTC';
const HEARTBEAT = '/tmp/scheduler-heartbeat';

const log = {
  info: (msg) => console.log(`${new Date().toISOString()} INFO ${msg}`),
  error: (msg) => console.error(`${new Date().toISOString()} ERROR ${msg}`),
};

let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    log.info(`${signal}: stopping after the current job`);
    stopping = true;
  });
}

configureScanApi({ baseUrl });
log.info(`Scheduler ${workerId} started: ${baseUrl}, every ${tickMs / 1000}s, default time zone ${defaultTimeZone}`);

while (!stopping) {
  try {
    await runDueJobs({ workerId, baseUrl, log, defaultTimeZone });
  } catch (error) {
    // The store or API is down: try again next tick (scans already claimed time out and are retaken).
    log.error(`Tick failed: ${error?.message || error}`);
  }
  writeFileSync(HEARTBEAT, new Date().toISOString());
  for (let waited = 0; waited < tickMs && !stopping; waited += 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
log.info('Scheduler stopped');
