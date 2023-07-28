
exports.redis_query = async function (options) {
  try {
    if (!redisClient) {
      throw new Error('Redis client is not available.');
    }
    const key = this.parse(options.key); 
    if (!key) {
      throw new Error('Invalid key provided.');
    }
    const output = await redisClient.get(key);
    if (typeof output === 'string') {
      const parsedOutput = JSON.parse(output);
      return parsedOutput;
    }
    return output;
  } catch (error) {
    console.log('Redis query error:', error);
    throw error;
  }
};