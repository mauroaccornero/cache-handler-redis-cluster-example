const {commandOptions } = require('redis');
const { isImplicitTag, getTimeoutRedisCommandOptions } = require('@neshca/cache-handler/helpers');

// Create a custom Redis Handler
const customRedisClusterHandler = ({keyPrefix, sharedTagsKey, timeoutMs, cluster}) => {
    function assertClientIsReady() {
        if (!cluster) {
            throw new Error('Redis cluster is not ready yet or connection is lost.');
        }
    }

    let normalizedKeyPrefix = `{${keyPrefix}}`

    const revalidatedTagsKey = `${normalizedKeyPrefix}__revalidated_tags__`;
    return ({

        // Give the handler a name.
        // It is useful for logging in debug mode.
        name: 'redis-cluster-strings-custom',
        // We do not use try/catch blocks in the Handler methods.
        // CacheHandler will handle errors and use the next available Handler.
        async get(key, { implicitTags }) {
            // Ensure that the cluster is ready before using it.
            // If the cluster is not ready, the CacheHandler will use the next available Handler.
            assertClientIsReady();

            // Create a new AbortSignal with a timeout for the Redis operation.
            // By default, redis cluster operations will wait indefinitely.
            const options = commandOptions({ signal: AbortSignal.timeout(timeoutMs) });

            // Get the value from Redis.
            // We use the key prefix to avoid key collisions with other data in Redis.
            const result = await cluster.get(options, normalizedKeyPrefix + key);

            // If the key does not exist, return null.
            if (!result) {
                return null;
            }

            // Redis stores strings, so we need to parse the JSON.
            const cacheValue = JSON.parse(result);

            // If the cache value has no tags, return it early.
            if (!cacheValue) {
                return null;
            }

            // Get the set of explicit and implicit tags.
            // implicitTags are available only on the `get` method.
            const combinedTags = new Set([...cacheValue.tags, ...implicitTags]);

            // If there are no tags, return the cache value early.
            if (combinedTags.size === 0) {
                return cacheValue;
            }

            // Get the revalidation times for the tags.
            const revalidationTimes = await cluster.hmGet(
                commandOptions({ signal: AbortSignal.timeout(timeoutMs) }),
                revalidatedTagsKey,
                Array.from(combinedTags),
            );

            // Iterate over all revalidation times.
            for (const timeString of revalidationTimes) {
                // If the revalidation time is greater than the last modified time of the cache value,
                if (timeString && Number.parseInt(timeString, 10) > cacheValue.lastModified) {
                    // Delete the key from Redis.
                    await cluster.unlink(commandOptions({ signal: AbortSignal.timeout(timeoutMs) }), normalizedKeyPrefix + key);

                    // Return null to indicate cache miss.
                    return null;
                }
            }

            // Return the cache value.
            return cacheValue;
        },
        async set(key, cacheHandlerValue) {
            // Ensure that the cluster is ready before using it.
            assertClientIsReady();

            // Create a new AbortSignal with a timeout for the Redis operation.
            const options = commandOptions({ signal: AbortSignal.timeout(timeoutMs) });

            // Redis stores strings, so we need to stringify the JSON.
            const setOperation = cluster.set(options, normalizedKeyPrefix + key, JSON.stringify(cacheHandlerValue));

            // If the cacheHandlerValue has a lifespan, set the automatic expiration.
            // cacheHandlerValue.lifespan can be null if the value is the page from the Pages Router without getStaticPaths or with `fallback: false`
            // so, we need to check if it exists before using it
            const expireOperation = cacheHandlerValue.lifespan
                ? cluster.expireAt(options, normalizedKeyPrefix + key, cacheHandlerValue.lifespan.expireAt)
                : undefined;

            // If the cache handler value has tags, set the tags.
            // We store them separately to save time to retrieve them in the `revalidateTag` method.
            const setTagsOperation = cacheHandlerValue.tags.length
                ? cluster.hSet(options, normalizedKeyPrefix + sharedTagsKey, key, JSON.stringify(cacheHandlerValue.tags))
                : undefined;

            // Wait for all operations to complete.
            await Promise.all([setOperation, expireOperation, setTagsOperation]);
        },
        async revalidateTag(tag) {
            // Ensure that the cluster is ready before using it.
            assertClientIsReady();

            // Check if the tag is implicit.
            // Implicit tags are not stored in the cached values.
            if (isImplicitTag(tag)) {
                // Mark the tag as revalidated at the current time.
                await cluster.hSet(
                    commandOptions({ signal: AbortSignal.timeout(timeoutMs) }),
                    revalidatedTagsKey,
                    tag,
                    Date.now(),
                );
            }

            // Create a map to store the tags for each key.
            const tagsMap = new Map();

            // Cursor for the hScan operation.
            let cursor = 0;

            // Define a query size for the hScan operation.
            const hScanOptions = { COUNT: 100 };

            // Iterate over all keys in the shared tags.
            do {
                const remoteTagsPortion = await cluster.hScan(
                    commandOptions({ signal: AbortSignal.timeout(timeoutMs) }),
                    normalizedKeyPrefix + sharedTagsKey,
                    cursor,
                    hScanOptions,
                );

                // Iterate over all keys in the portion.
                for (const { field, value } of remoteTagsPortion.tuples) {
                    // Parse the tags from the value.
                    tagsMap.set(field, JSON.parse(value));
                }

                // Update the cursor for the next iteration.
                cursor = remoteTagsPortion.cursor;

                // If the cursor is 0, we have reached the end.
            } while (cursor !== 0);

            // Create an array of keys to delete.
            const keysToDelete = [];

            // Create an array of tags to delete from the hash map.
            const tagsToDelete = [];

            // Iterate over all keys and tags.
            for (const [key, tags] of tagsMap) {
                // If the tags include the specified tag, add the key to the delete list.
                if (tags.includes(tag)) {
                    // Key must be prefixed because we use the key prefix in the set method.
                    keysToDelete.push(normalizedKeyPrefix + key);
                    // Set an empty string as the value for the revalidated tag.
                    tagsToDelete.push(key);
                }
            }

            // If there are no keys to delete, return early.
            if (keysToDelete.length === 0) {
                return;
            }

            // Delete the keys from Redis.
            const deleteKeysOperation = cluster.unlink(
                commandOptions({ signal: AbortSignal.timeout(timeoutMs) }),
                keysToDelete,
            );

            // Update the tags in Redis by deleting the revalidated tags.
            const updateTagsOperation = cluster.hDel(
                // Use the isolated option to prevent the command from being executed on the main connection.
                { isolated: true, ...getTimeoutRedisCommandOptions(timeoutMs) },
                normalizedKeyPrefix + sharedTagsKey,
                tagsToDelete,
            );

            // Wait for all operations to complete.
            await Promise.all([deleteKeysOperation, updateTagsOperation]);
        },
    });
}

module.exports = customRedisClusterHandler