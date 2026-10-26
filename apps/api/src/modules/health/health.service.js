const DB_CHECK_TIMEOUT_MS = 2000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function createHealthService({
  checkDatabase,
  version,
  startedAt = Date.now(),
  now = Date.now,
}) {
  return {
    // Liveness: the process is running. Never touches the database.
    liveness() {
      return {
        status: 'ok',
        service: 'vrumm-api',
        version,
        uptimeSeconds: Math.floor((now() - startedAt) / 1000),
        time: new Date(now()).toISOString(),
      };
    },
    // Readiness: dependencies are reachable.
    async readiness() {
      const dbUp = await withTimeout(
        Promise.resolve(checkDatabase()).catch(() => false),
        DB_CHECK_TIMEOUT_MS,
      );
      const checks = { database: dbUp ? 'up' : 'down' };
      return { ready: dbUp, status: dbUp ? 'ok' : 'unavailable', checks };
    },
  };
}
