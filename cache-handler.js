const { CacheHandler } = require("@neshca/cache-handler");
const { createCluster } = require("redis");
const { PHASE_PRODUCTION_BUILD } = require("next/constants");

const customRedisClusterHandler =  require("./custom-cache-handler");

/* from https://caching-tools.github.io/next-shared-cache/redis */
CacheHandler.onCreation(async () => {
  let cluster;
  // use redis cluster during build could cause issue https://github.com/caching-tools/next-shared-cache/issues/284#issuecomment-1919145094
  if (PHASE_PRODUCTION_BUILD !== process.env.NEXT_PHASE) {
    try {
      // Create a Redis cluster.
      cluster = createCluster({
        rootNodes: [
          {
            url: 'redis://172.38.0.11:6379'
          },
          {
            url: 'redis://172.38.0.12:6379'
          },
          {
            url: 'redis://172.38.0.13:6379'
          },
          {
            url: 'redis://172.38.0.14:6379'
          },
          {
            url: 'redis://172.38.0.15:6379'
          },
          {
            url: 'redis://172.38.0.16:6379'
          }
        ]
      });


      // Redis won't work without error handling.
      cluster.on("error", (e) => {
        throw e;
      });


    } catch (error) {
      console.warn("Failed to create Redis cluster:", error);
    }
  }

  if (cluster) {
    try {
      console.info("Connecting Redis cluster...");

      // Wait for the cluster to connect.
      // Caveat: This will block the server from starting until the cluster is connected.
      // And there is no timeout. Make your own timeout if needed.
      await cluster.connect();
      console.info("Redis cluster connected.");
    } catch (error) {
      console.warn("Failed to connect Redis cluster:", error);

      console.warn("Disconnecting the Redis cluster...");
      // Try to disconnect the cluster to stop it from reconnecting.
      cluster
        .disconnect()
        .then(() => {
          console.info("Redis cluster disconnected.");
        })
        .catch(() => {
          console.warn(
            "Failed to quit the Redis cluster after failing to connect.",
          );
        });
    }
  }

  /** @type {import("@neshca/cache-handler").Handler | null} */
  let redisHandler = null;

  if (cluster) {
    redisHandler = customRedisClusterHandler(
    {keyPrefix:"my-app-cache:",sharedTagsKey:"_sharedTags_", timeoutMs: 1000, cluster})
  }


  return {
    handlers: [redisHandler],
  };
});

module.exports = CacheHandler;
