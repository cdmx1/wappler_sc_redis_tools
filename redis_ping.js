exports.redis_ping = async function (options) {
  const timeout = this.parse(options.timeout) || 5000; // Default timeout: 5 seconds
  if (!redisClient) {
    throw new Error('Redis client is not available.');
  }
  const pingPromise = redisClient.ping();
  try {
    // Wait for the ping operation or timeout, whichever occurs first
    const output = await Promise.race([
      pingPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping operation timed out.')), timeout))
    ]);

    return output;
  } catch (error) {
    throw error;
  }
};