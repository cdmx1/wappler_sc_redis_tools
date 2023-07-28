exports.redis_insert = async function (options) {
    if (!redisClient) {
        throw new Error('Redis client is not available.');
      }
      const key = this.parse(options.key)
      const data = this.parse(options.data)
      if (!key || !data) {
        throw new Error('Invalid key or data provided.');
      }
    await redisClient.set(key, JSON.stringify(data), (error, result) => {
        if (error) {
            console.error('Error setting JSON array data:', error);
        }
    });
}
