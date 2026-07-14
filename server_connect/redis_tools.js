const fs = require("fs/promises");
const path = require("path");
const { toSystemPath } = require("../../../lib/core/path");
const ioredis = require("ioredis");

// Initialize a global Redis client if it doesn't exist
let redis;

if (process.env.REDIS_HOST) {
  redis = new ioredis({
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST,
    db: process.env.REDIS_DB || 0,
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USER || undefined,
    tls: process.env.REDIS_TLS || undefined,
  });
} else {
  redis = global.redisClient;
}

exports.redis_query = async function (options) {
  try {
    if (!redis) {
      throw new Error('Redis client is not available.');
    }
    const key = this.parse(options.key);
    if (!key) {
      throw new Error('Invalid key provided.');
    }
    const output = await redis.get(key);
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


exports.redis_ping = async function (options) {
  const timeout = this.parse(options.timeout) || 5000; // Default timeout: 5 seconds
  if (!redis) {
    throw new Error('Redis client is not available.');
  }
  const pingPromise = redis.ping();
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

exports.redis_insert = async function (options) {
  if (!redis) {
    throw new Error('Redis client is not available.');
  }
  const key = this.parse(options.key)
  const data = this.parse(options.data)
  if (!key || !data) {
    throw new Error('Invalid key or data provided.');
  }
  await redis.set(key, JSON.stringify(data), (error, result) => {
    if (error) {
      console.error('Error setting JSON array data:', error);
    }
  });
  return { success: true };
}

exports.redis_delete = async function (options) {
  if (!redis) {
    throw new Error('Redis client is not available.');
  }
  const key = this.parse(options.key);
  if (!key) {
    throw new Error('Invalid key provided.');
  }
  const deleted = await redis.del(key);
  return { success: true, deleted };
};

/**
 * Masks sensitive data by keeping only last N characters
 * @param {string} input The input string to mask
 * @returns {string} The masked string
 */
const maskData = (input) => {
  const inputString = String(input);
  const length = inputString.length;

  if (length <= 3) {
    return '**' + inputString.slice(-1);
  } else if (length <= 6) {
    return '**' + inputString.slice(-2);
  } else if (length <= 9) {
    return '**' + inputString.slice(-3);
  } else {
    return '**' + inputString.slice(-4);
  }
};

/**
 * Loads and validates PII configuration from pii-fields.json
 * @returns {object|null} The validated PII config or null if invalid
 */
const loadPiiConfig = async () => {
  try {
    const config = require('../../../app/config/pii-fields.json');
    // Validate required properties
    const hasRedactedFields = Array.isArray(config.redacted_fields) && config.redacted_fields.length > 0;
    const hasMaskedFields = Array.isArray(config.masked_fields) && config.masked_fields.length > 0;

    if (!hasRedactedFields || !hasMaskedFields) {
      return null;
    }

    return config;
  } catch (error) {
    console.error('Error loading PII configuration:', error);
    return null;
  }
};

/**
 * Safely parses an object by stringifying and then parsing it.
 * If the input is not an object or parsing fails, it returns a default structure.
 *
 * @param {any} input The input value (from options or context).
 * @returns {object} The safely parsed object or a default object structure.
 */
const safeParseObject = (input) => {
  const parsedInput = input;

  if (typeof parsedInput === 'object' && parsedInput !== null) {

    try {
      return JSON.parse(JSON.stringify(parsedInput));
    } catch (error) {
      console.error('Error during safe object parsing for logging:', error);
      return { data: parsedInput };
    }
  }

  return { data: parsedInput };
};

/**
 * Recursively sanitizes context data based on PII configuration
 * @param {any} data The data to sanitize
 * @param {object} piiConfig The PII configuration object
 * @returns {any} The sanitized data
 */
const sanitizeContext = (data, piiConfig) => {
  if (!piiConfig) {
    return {};
  }

  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeContext(item, piiConfig));
  }

  const sanitized = { ...data };

  for (const key in sanitized) {
    if (sanitized.hasOwnProperty(key)) {

      // Check if value should be redacted
      if (piiConfig.redacted_fields.includes(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Check if value should be masked
      if (piiConfig.masked_fields.includes(key)) {
        sanitized[key] = maskData(sanitized[key]);
        continue;
      }

      // Recursively sanitize nested objects and arrays
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeContext(sanitized[key], piiConfig);
      }
    }
  }

  return sanitized;
};

const toStringOrEmpty = (value) => {
  const parsedValue = value;
  return parsedValue !== undefined && parsedValue !== null
    ? String(parsedValue)
    : "";
};

/**
 * ASTRA-4927: Take proper snapshot of object data for aux and, if provided, p_value
 */
exports.redis_log_insert = async function (options) {
  if (!redis) {
    throw new Error('Redis client is not available.');
  }

  const utcDate = new Date().toISOString();

  // Load and validate PII configuration
  const piiConfig = await loadPiiConfig();

  const p_value = this.parse(options.p_value);
  const logData = {
    ts: utcDate,
    level: toStringOrEmpty(this.parse(options.log_level)),
    e_event: toStringOrEmpty(this.parse(options.event)),
    e_id: toStringOrEmpty(this.parse(options.id)),
    e_type: toStringOrEmpty(this.parse(options.e_type)),
    uid: Number(this.parse(options.user_id)),
    error_code: toStringOrEmpty(this.parse(options.error_code)),
    git_version: process.env.LOG_GIT_VERSION || '',
    msg: toStringOrEmpty(this.parse(options.message)),
    domain: toStringOrEmpty(this.parse(options.domain)),
    sys: toStringOrEmpty(this.parse(options.system)),
    sess_id: toStringOrEmpty(this.parse(options.session_id)),
    entry_type: toStringOrEmpty(this.parse(options.entry_type)),
    p_key: toStringOrEmpty(this.parse(options.p_key)),
    aux: sanitizeContext(safeParseObject(this.parse(options.context)), piiConfig),
    p_value: typeof p_value === 'object' ? sanitizeContext(safeParseObject(p_value), piiConfig) : toStringOrEmpty(p_value)
  };

  const jsonString = JSON.stringify(logData);

  // Push the JSON data onto a Redis list
  await redis.rpush(this.parse(process.env.LOG_REDIS_KEY), jsonString, (error, result) => {
    if (error) {
      console.error('Error pushing data to Redis list:', error);
    }
  });
  return { success: true };
};
