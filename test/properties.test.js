import test from "node:test";
import assert from "node:assert/strict";
import { guest, signedIn, upload, useTestApp } from "./helpers.js";

useTestApp({ seed: true });

const API = "/api/v1/properties";

const newProperty = (overrides = {}) => ({
  name: "Riverside Villa",
  reference: "SF-100",
  category: "rent",
  type: "House",
  location: "Karen, Nairobi",
  description: "A four-bedroom villa with a mature garden.",
  price: { amount: 250000, period: "month" },
  bedrooms: 4,
  bathrooms: 3,
  areaSqm: 320.5,
  amenities: ["Garden", "Borehole"],
  ...overrides,
});

test("lists the seeded published properties newest first", async () => {
  const res = await guest().get(API).expect(200);
  const { properties, pagination } = res.body.data;
  assert.equal(pagination.total, 5);
  assert.deepEqual(properties.map((p) => p.slug).slice(0, 2), ["apartment-01", "apartment-02"]);
  assert.equal(properties[0].images[0].position, "50% 65%");
  assert.match(properties[0].images[0].url, /^https:\/\//);
  assert.equal(properties[0].category, null);
  assert.equal(properties[0].author, undefined);
});

test("filters by type, search text and unconfirmed category, and paginates", async () => {
  const houses = await guest().get(API).query({ type: "House" }).expect(200);
  assert.equal(houses.body.data.pagination.total, 3);
  const search = await guest().get(API).query({ search: "veranda" }).expect(200);
  assert.deepEqual(search.body.data.properties.map((p) => p.slug), ["veranda-house"]);
  const unconfirmed = await guest().get(API).query({ category: "unconfirmed" }).expect(200);
  assert.equal(unconfirmed.body.data.pagination.total, 5);
  const page = await guest().get(API).query({ page: 2, limit: 2 }).expect(200);
  assert.deepEqual(page.body.data.pagination, { page: 2, limit: 2, total: 5, totalPages: 3 });
  await guest().get(API).query({ limit: 101 }).expect(400);
});

test("returns one property by slug and 404 for unknown slugs", async () => {
  const res = await guest().get(`${API}/slug/garden-residence`).expect(200);
  assert.equal(res.body.data.property.reference, "SF-001");
  await guest().get(`${API}/slug/nope`).expect(404);
});

test("creates a draft, hides it publicly, then publishes it", async () => {
  const agent = await signedIn();
  const created = await agent.post(API).send(newProperty()).expect(201);
  const property = created.body.data.property;
  assert.equal(property.slug, "riverside-villa");
  assert.equal(property.status, "draft");
  assert.deepEqual(property.price, { amount: 250000, currency: "KES", period: "month" });
  await guest().get(`${API}/slug/riverside-villa`).expect(404);

  // Publishing needs a photo.
  const blocked = await agent.patch(`${API}/${property._id}/publish`).expect(400);
  assert.match(blocked.body.message, /photo/);

  const photo = await upload(agent);
  await agent.patch(`${API}/${property._id}`).send({ images: [{ ...photo, alt: "Front of the villa" }] }).expect(200);
  const published = await agent.patch(`${API}/${property._id}/publish`).expect(200);
  assert.equal(published.body.data.property.status, "published");
  assert.ok(published.body.data.property.publishedAt);
  await guest().get(`${API}/slug/riverside-villa`).expect(200);
});

test("normalizes prices by category", async () => {
  const agent = await signedIn();
  const managed = await agent.post(API).send(newProperty({ reference: "SF-101", category: "managed" })).expect(201);
  assert.equal(managed.body.data.property.price, null);
  const sale = await agent.post(API).send(newProperty({ reference: "SF-102", category: "sale" })).expect(201);
  assert.equal(sale.body.data.property.price.period, "");
  const rent = await agent.post(API).send(newProperty({ reference: "SF-103", price: { amount: 1 } })).expect(400);
  assert.match(rent.body.message, /rental period/);

  // Switching a sale listing to managed clears its price.
  const id = sale.body.data.property._id;
  const updated = await agent.patch(`${API}/${id}`).send({ category: "managed" }).expect(200);
  assert.equal(updated.body.data.property.price, null);
});

test("rejects duplicate references and slugs, and invalid input", async () => {
  const agent = await signedIn();
  const duplicate = await agent.post(API).send(newProperty({ reference: "SF-001" })).expect(409);
  assert.match(duplicate.body.message, /reference/);
  await agent.post(API).send(newProperty({ reference: "SF-110", slug: "garden-residence" })).expect(409);
  const second = await agent.post(API).send(newProperty({ reference: "SF-111" })).expect(201);
  await agent.post(API).send(newProperty({ reference: "SF-112" })).expect(201);
  assert.equal(second.body.data.property.slug, "riverside-villa");
  const third = await agent.post(API).send(newProperty({ reference: "SF-113" })).expect(201);
  assert.equal(third.body.data.property.slug, "riverside-villa-3");

  const invalid = await agent.post(API).send(newProperty({ reference: "SF-114", type: "Castle" })).expect(400);
  assert.match(invalid.body.message, /^type:/);
  const images = Array.from({ length: 6 }, () => ({ url: "https://x.test/a.jpg", alt: "A" }));
  await agent.post(API).send(newProperty({ reference: "SF-115", images })).expect(400);
  await agent.post(API).send(newProperty({ reference: "SF-116", images: [{ url: "http://x.test/a.jpg", alt: "A" }] })).expect(400);
});

test("staff list includes drafts and filters by status; unknown ids are 404", async () => {
  const agent = await signedIn();
  await agent.post(API).send(newProperty()).expect(201);
  const all = await agent.get(`${API}/admin/all`).expect(200);
  assert.equal(all.body.data.pagination.total, 6);
  const drafts = await agent.get(`${API}/admin/all`).query({ status: "draft" }).expect(200);
  assert.equal(drafts.body.data.properties[0].name, "Riverside Villa");
  await agent.get(`${API}/admin/507f1f77bcf86cd799439011`).expect(404);
  await agent.get(`${API}/admin/not-an-id`).expect(404);
});

test("a published property cannot lose all its photos; delete removes it", async () => {
  const agent = await signedIn();
  const [first] = (await agent.get(`${API}/admin/all`).query({ search: "garden" })).body.data.properties;
  await agent.patch(`${API}/${first._id}`).send({ images: [] }).expect(400);
  await agent.delete(`${API}/${first._id}`).expect(200);
  await guest().get(`${API}/slug/garden-residence`).expect(404);
});
