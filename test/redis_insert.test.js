"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule, makeContext, createFakeRedis } = require("./helpers");

test("redis_insert stores the JSON-stringified data under the key", async () => {
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  await mod.redis_insert.call(makeContext(), {
    key: "session:42",
    data: { token: "abc", roles: ["admin"] },
  });

  assert.deepEqual(redis.calls, [
    ["set", "session:42", JSON.stringify({ token: "abc", roles: ["admin"] })],
  ]);
  assert.equal(
    redis.store.get("session:42"),
    JSON.stringify({ token: "abc", roles: ["admin"] })
  );
});

test("redis_insert returns { success: true }", async () => {
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  const result = await mod.redis_insert.call(makeContext(), {
    key: "k",
    data: { a: 1 },
  });

  assert.deepEqual(result, { success: true });
});

test("redis_insert stringifies primitive data too", async () => {
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  await mod.redis_insert.call(makeContext(), { key: "k", data: "hello" });

  assert.equal(redis.store.get("k"), JSON.stringify("hello"));
});

test("redis_insert throws on a missing key", async () => {
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  await assert.rejects(
    () => mod.redis_insert.call(makeContext(), { key: "", data: { a: 1 } }),
    /Invalid key or data/
  );
  assert.equal(redis.calls.length, 0);
});

test("redis_insert throws on missing data", async () => {
  const redis = createFakeRedis();
  const mod = loadModule({ redisClient: redis });

  await assert.rejects(
    () => mod.redis_insert.call(makeContext(), { key: "k", data: null }),
    /Invalid key or data/
  );
  assert.equal(redis.calls.length, 0);
});

test("redis_insert throws when no Redis client is available", async () => {
  const mod = loadModule({ redisClient: undefined });

  await assert.rejects(
    () => mod.redis_insert.call(makeContext(), { key: "k", data: { a: 1 } }),
    /Redis client is not available/
  );
});
