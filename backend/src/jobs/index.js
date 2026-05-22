'use strict';

// ============================================================================
// Job runner.
// ----------------------------------------------------------------------------
// The single entry point for every scheduled job. A cron or scheduler invokes:
//
//   node src/jobs/index.js refill-reminders
//   node src/jobs/index.js billing-sweep
//   node src/jobs/index.js payout-run
//
// The runner verifies the database connection, runs the named job, drains the
// connection pool, and exits with 0 on success or 1 on failure so the
// scheduler can alert on a non-zero exit.
// ============================================================================

const logger = require('../utils/logger');
const { verifyConnection, closePool } = require('../db/pool');

// The registry of runnable jobs, keyed by their CLI name.
const JOBS = {
  'refill-reminders': require('./refill-reminders.job'),
  'billing-sweep': require('./billing-sweep.job'),
  'payout-run': require('./payout-run.job'),
};

// Run one job by name. Resolves with a process exit code (0 ok, 1 failure).
async function runJob(name) {
  const job = JOBS[name];
  if (!job) {
    logger.error('Unknown job requested', {
      name: name,
      available: Object.keys(JOBS),
    });
    return 1;
  }

  try {
    await verifyConnection();
    await job.run();
    return 0;
  } catch (err) {
    logger.error('Job run failed', { name: name, message: err.message });
    return 1;
  } finally {
    try {
      await closePool();
    } catch (closeErr) {
      logger.error('Error closing database pool after job', {
        message: closeErr.message,
      });
    }
  }
}

// CLI entry: run the job named in argv and exit with its code.
if (require.main === module) {
  const name = process.argv[2];
  if (!name) {
    process.stderr.write(
      'Usage: node src/jobs/index.js <' + Object.keys(JOBS).join(' | ') + '>\n'
    );
    process.exit(1);
  }
  runJob(name).then(function (code) {
    process.exit(code);
  });
}

module.exports = {
  JOBS: JOBS,
  runJob: runJob,
};
