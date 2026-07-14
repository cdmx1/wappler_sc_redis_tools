"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loadModule,
  makeContext,
  createFakeRedis,
  setPiiConfig,
  silenceConsole,
} = require("./helpers");

// Reads back the single JSON entry pushed onto the configured log list.
function lastLogEntry(redis, listKey) {
  const list = redis.lists.get(listKey);
  assert.ok(list && list.length, "expected a log entry to be pushed");
  return JSON.parse(list[list.length - 1]);
}

const LOG_KEY = "app:logs";

let restoreConsole;
test.beforeEach(() => {
  restoreConsole = silenceConsole();
  process.env.LOG_REDIS_KEY = LOG_KEY;
  delete process.env.LOG_GIT_VERSION;
  setPiiConfig(undefined); // default: no PII config present
});
test.afterEach(() => restoreConsole());

test("redis_log_insert pushes a normalized log entry onto the list", async () => {
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  await mod.redis_log_insert.call(makeContext(), {
    log_level: "info",
    event: "login",
    id: "evt-1",
    e_type: "auth",
    user_id: "7",
    message: "user logged in",
    domain: "site.example.com",
    system: "nps",
    session_id: "sess-9",
  });

  const entry = lastLogEntry(redis, LOG_KEY);
  assert.equal(entry.level, "info");
  assert.equal(entry.e_event, "login");
  assert.equal(entry.e_id, "evt-1");
  assert.equal(entry.e_type, "auth");
  assert.equal(entry.uid, 7); // user_id is coerced to a Number
  assert.equal(entry.msg, "user logged in");
  assert.equal(entry.domain, "site.example.com");
  assert.equal(entry.sys, "nps");
  assert.equal(entry.sess_id, "sess-9");
  assert.match(entry.ts, /^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
});

test("redis_log_insert coerces absent optional fields to empty strings", async () => {
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  await mod.redis_log_insert.call(makeContext(), {
    log_level: "info",
    message: "minimal",
  });

  const entry = lastLogEntry(redis, LOG_KEY);
  assert.equal(entry.error_code, "");
  assert.equal(entry.entry_type, "");
  assert.equal(entry.p_key, "");
  // user_id is missing -> Number(undefined) -> NaN, serialized by JSON as null.
  assert.equal(entry.uid, null);
});

test("redis_log_insert reads git version from LOG_GIT_VERSION", async () => {
  process.env.LOG_GIT_VERSION = "v1.2.3";
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  await mod.redis_log_insert.call(makeContext(), { message: "x" });

  assert.equal(lastLogEntry(redis, LOG_KEY).git_version, "v1.2.3");
});

test("redis_log_insert leaves aux empty when no PII config is loaded", async () => {
  setPiiConfig(undefined);
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  await mod.redis_log_insert.call(makeContext(), {
    message: "x",
    context: { email: "a@b.com", note: "hi" },
  });

  // sanitizeContext returns {} when piiConfig is null.
  assert.deepEqual(lastLogEntry(redis, LOG_KEY).aux, {});
});

test("redis_log_insert redacts and masks aux fields per PII config", async () => {
  setPiiConfig({
    redacted_fields: ["password"],
    masked_fields: ["email"],
  });
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  await mod.redis_log_insert.call(makeContext(), {
    message: "x",
    context: {
      password: "supersecret",
      email: "alice@example.com",
      keep: "visible",
      nested: { password: "deep" },
    },
  });

  const aux = lastLogEntry(redis, LOG_KEY).aux;
  assert.equal(aux.password, "[REDACTED]");
  // maskData keeps the last 4 chars for length > 9.
  assert.equal(aux.email, "**.com");
  assert.equal(aux.keep, "visible");
  assert.equal(aux.nested.password, "[REDACTED]"); // recursive
});

test("redis_log_insert sanitizes object p_value but stringifies primitives", async () => {
  setPiiConfig({ redacted_fields: ["secret"], masked_fields: ["x"] });
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  // Object p_value -> sanitized object.
  await mod.redis_log_insert.call(makeContext(), {
    message: "obj",
    p_value: { secret: "hide-me", ok: 1 },
  });
  assert.deepEqual(lastLogEntry(redis, LOG_KEY).p_value, {
    secret: "[REDACTED]",
    ok: 1,
  });

  // Primitive p_value -> stringified.
  await mod.redis_log_insert.call(makeContext(), {
    message: "prim",
    p_value: 12345,
  });
  assert.equal(lastLogEntry(redis, LOG_KEY).p_value, "12345");
});

test("redis_log_insert ignores an invalid PII config (missing arrays)", async () => {
  // Arrays present but empty -> loadPiiConfig returns null -> aux is {}.
  setPiiConfig({ redacted_fields: [], masked_fields: [] });
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  await mod.redis_log_insert.call(makeContext(), {
    message: "x",
    context: { email: "a@b.com" },
  });

  assert.deepEqual(lastLogEntry(redis, LOG_KEY).aux, {});
});

test("redis_log_insert returns { success: true }", async () => {
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  const result = await mod.redis_log_insert.call(makeContext(), {
    message: "x",
  });

  assert.deepEqual(result, { success: true });
});

test("redis_log_insert throws when no Redis client is available", async () => {
  const mod = loadModule({ redisClient: undefined });

  await assert.rejects(
    () => mod.redis_log_insert.call(makeContext(), { message: "x" }),
    /Redis client is not available/
  );
});
