import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN, guest, signedIn, upload, useTestApp } from "./helpers.js";

useTestApp({ seed: true });

const API = "/api/v1";

// ---------- Services ----------
test("lists published services grouped by category", async () => {
  const res = await guest().get(`${API}/services`).expect(200);
  const { categories } = res.body.data;
  assert.deepEqual(categories.map((c) => c.number), ["01", "02"]);
  assert.equal(categories[0].title, "Property Purchase Services");
  assert.equal(categories[0].services.length, 4);
  assert.equal(categories[0].services[0].title, "Property search & acquisition support");
  assert.equal(categories[0].services[0].icon, "Search");
});

test("creates sanitized service drafts, publishes them and edits category text", async () => {
  const agent = await signedIn();
  const photo = await upload(agent, "services");
  const created = await agent
    .post(`${API}/services`)
    .send({
      category: "02",
      title: "Rent collection",
      description: '<p onclick="x()">Monthly <b>rent</b><script>alert(1)</script><span style="color:red;font-size:18px">!</span></p>',
      icon: "Wallet",
      image: { ...photo, alt: "Keys" },
    })
    .expect(201);
  const service = created.body.data.service;
  assert.equal(service.status, "draft");
  assert.equal(service.description, '<p>Monthly <b>rent</b><span style="font-size:18px">!</span></p>');
  assert.equal((await guest().get(`${API}/services`)).body.data.categories[1].services.length, 4);

  await agent.patch(`${API}/services/${service._id}/publish`).expect(200);
  const published = (await guest().get(`${API}/services`)).body.data.categories[1].services.at(-1);
  assert.equal(published.title, "Rent collection");
  assert.equal(published.image.alt, "Keys");

  const category = await agent.patch(`${API}/services/categories/02`).send({ title: "Management" }).expect(200);
  assert.equal(category.body.data.category.title, "Management");
  await agent.patch(`${API}/services/categories/09`).send({ title: "X" }).expect(404);
});

test("rejects empty service descriptions and unknown categories", async () => {
  const agent = await signedIn();
  await agent.post(`${API}/services`).send({ category: "01", title: "X", description: "<p> </p>" }).expect(400);
  const bad = await agent.post(`${API}/services`).send({ category: "09", title: "X", description: "Text" }).expect(400);
  assert.match(bad.body.message, /category/);
});

test("reorders services", async () => {
  const agent = await signedIn();
  const list = (await agent.get(`${API}/services/admin/all`).query({ category: "01" })).body.data.services;
  const reversed = list.map((s) => s._id).reverse();
  await agent.patch(`${API}/services/reorder`).send({ ids: reversed }).expect(200);
  const after = (await agent.get(`${API}/services/admin/all`).query({ category: "01" })).body.data.services;
  assert.deepEqual(after.map((s) => s._id), reversed);
  await agent.patch(`${API}/services/reorder`).send({ ids: ["507f1f77bcf86cd799439011"] }).expect(400);
});

// ---------- Blog ----------
test("serves seeded articles, hides drafts and generates slug and excerpt", async () => {
  const agent = await signedIn();
  const list = await guest().get(`${API}/blog`).expect(200);
  assert.equal(list.body.data.pagination.total, 3);
  assert.equal(list.body.data.posts[0].content, undefined);
  const article = await guest().get(`${API}/blog/slug/make-your-property-viewing-count`).expect(200);
  assert.match(article.body.data.post.content, /<h2>Start with your everyday needs<\/h2>/);

  const draft = await agent.post(`${API}/blog`).send({ title: "Market update", content: "<p>Prices are steady.</p>" }).expect(201);
  const post = draft.body.data.post;
  assert.equal(post.slug, "market-update");
  assert.equal(post.status, "draft");
  assert.equal(post.excerpt, "Prices are steady.");
  assert.equal(post.author.name, ADMIN.name);
  await guest().get(`${API}/blog/slug/market-update`).expect(404);

  await agent.patch(`${API}/blog/${post._id}/publish`).expect(200);
  const latest = (await guest().get(`${API}/blog`)).body.data.posts[0];
  assert.equal(latest.slug, "market-update");
  assert.equal(latest.author.name, ADMIN.name);
  assert.equal(latest.author.email, undefined);
});

test("allows https inline images with alt text only", async () => {
  const agent = await signedIn();
  const photo = await upload(agent, "blog");
  const ok = await agent
    .post(`${API}/blog`)
    .send({
      title: "Images",
      content: `<p>Hi</p><img src="${photo.url}" alt="Lounge"><img src="http://x.test/a.jpg" alt="Insecure"><img src="data:image/png;base64,AAAA" alt="Inline">`,
    })
    .expect(201);
  assert.equal(ok.body.data.post.content, `<p>Hi</p><img src="${photo.url}" alt="Lounge" />`);
  const noAlt = await agent.post(`${API}/blog`).send({ title: "No alt", content: `<p>Hi</p><img src="${photo.url}">` }).expect(400);
  assert.match(noAlt.body.message, /alternative text/);
});

test("editing the article body refreshes a generated excerpt", async () => {
  const agent = await signedIn();
  const { post } = (await agent.post(`${API}/blog`).send({ title: "Notes", content: "<p>First.</p>" })).body.data;
  const updated = await agent.patch(`${API}/blog/${post._id}`).send({ content: "<p>Second version.</p>" }).expect(200);
  assert.equal(updated.body.data.post.excerpt, "Second version.");
  await agent.patch(`${API}/blog/${post._id}`).send({ slug: "make-your-property-viewing-count" }).expect(409);
  await agent.delete(`${API}/blog/${post._id}`).expect(200);
  await agent.get(`${API}/blog/admin/${post._id}`).expect(404);
});

// ---------- Testimonials ----------
test("visitor submissions wait for review; the honeypot drops bots", async () => {
  const agent = await signedIn();
  const submission = { name: "Mary W.", comment: "Very professional team throughout.", rating: 5 };
  await guest().post(`${API}/testimonials/submit`).send(submission).expect(201);
  await guest().post(`${API}/testimonials/submit`).send({ ...submission, website: "spam.example" }).expect(201);
  await guest().post(`${API}/testimonials/submit`).send({ ...submission, rating: 6 }).expect(400);

  assert.equal((await guest().get(`${API}/testimonials`)).body.data.pagination.total, 0);
  const pending = (await agent.get(`${API}/testimonials/admin/all`).query({ status: "pending" })).body.data.testimonials;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].source, "public");

  await agent.patch(`${API}/testimonials/${pending[0]._id}/publish`).expect(200);
  const [shown] = (await guest().get(`${API}/testimonials`)).body.data.testimonials;
  assert.deepEqual(Object.keys(shown).sort(), ["_id", "comment", "name", "publishedAt", "rating"]);

  const unpublished = await agent.patch(`${API}/testimonials/${pending[0]._id}/publish`).expect(200);
  assert.equal(unpublished.body.data.testimonial.status, "draft");
});

test("staff can add, edit and delete testimonials", async () => {
  const agent = await signedIn();
  const created = await agent
    .post(`${API}/testimonials`)
    .send({ name: "John K.", comment: "Smooth handover of our apartment.", rating: 4, status: "published" })
    .expect(201);
  const { testimonial } = created.body.data;
  assert.equal(testimonial.source, "admin");
  assert.ok(testimonial.publishedAt);
  const edited = await agent.patch(`${API}/testimonials/${testimonial._id}`).send({ rating: 5 }).expect(200);
  assert.equal(edited.body.data.testimonial.rating, 5);
  await agent.delete(`${API}/testimonials/${testimonial._id}`).expect(200);
  assert.equal((await guest().get(`${API}/testimonials`)).body.data.pagination.total, 0);
});

// ---------- Dashboard ----------
test("dashboard summarizes content", async () => {
  const agent = await signedIn();
  await guest().post(`${API}/testimonials/submit`).send({ name: "Mary W.", comment: "Very professional team.", rating: 5 });
  const { data } = (await agent.get(`${API}/admin/dashboard`).expect(200)).body;
  assert.deepEqual(data.properties, {
    total: 5,
    published: 5,
    draft: 0,
    apartments: 2,
    houses: 3,
    byCategory: { sale: 0, rent: 0, managed: 0, unconfirmed: 5 },
  });
  assert.deepEqual(data.services, { published: 8, draft: 0 });
  assert.deepEqual(data.blog, { published: 3, draft: 0 });
  assert.deepEqual(data.testimonials, { pending: 1, draft: 0, published: 0 });
  assert.equal(data.recent.properties.length, 5);
  assert.equal(data.recent.pendingTestimonials[0].name, "Mary W.");
});
