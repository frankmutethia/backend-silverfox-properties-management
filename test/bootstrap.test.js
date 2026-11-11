import test from "node:test";
import assert from "node:assert/strict";
import { ctx, guest, useTestApp } from "./helpers.js";

useTestApp();

const API = "/api/v1";

test("a fresh start seeds only the starter articles, never services or properties", async () => {
  assert.equal(await ctx.bootstrap.seedContent(), true);

  const services = (await guest().get(`${API}/services`).expect(200)).body.data;
  assert.deepEqual(services.services ?? [], []);
  assert.ok((services.categories ?? []).every((category) => category.services.length === 0));

  const properties = (await guest().get(`${API}/properties`).expect(200)).body.data;
  assert.deepEqual(properties.properties, []);

  const blogs = (await guest().get(`${API}/blog`).expect(200)).body.data;
  assert.equal(blogs.posts.length, 3);

  // Restarting with articles present changes nothing.
  assert.equal(await ctx.bootstrap.seedContent(), false);
});
