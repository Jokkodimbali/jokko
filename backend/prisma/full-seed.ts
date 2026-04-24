import { disconnectSeedClient, runSeed } from './seed';

runSeed()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(disconnectSeedClient);
