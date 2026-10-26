import mongoose from 'mongoose';

export async function connectMongo({ uri, dbName, logger }) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10_000,
    retryWrites: true,
    w: 'majority',
  });
  logger.info({ dbName }, 'mongo connected');
  await assertReplicaSet(logger);
}

// Transactions only work on a replica set. Atlas clusters are replica sets.
// Fail early at startup instead of failing later inside a booking or payment flow.
async function assertReplicaSet(logger) {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName) {
    throw new Error(
      'MongoDB is not running as a replica set, so transactions will not work. Use an Atlas cluster.',
    );
  }
  logger.info({ replicaSet: hello.setName }, 'mongo replica set confirmed');
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}

// Used by the readiness endpoint. Returns true or false, never throws.
export async function checkDatabase() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
