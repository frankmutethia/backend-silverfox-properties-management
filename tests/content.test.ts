import { beforeEach, describe, expect, it } from "vitest";
import { guest, PNG, resetDb, signedIn, upload } from "./helpers.js";

describe("services", () => {
  beforeEach(() => resetDb({ seed: true }));

  it("lists the seeded published services grouped by category", async () => {
    const res = await guest().get("/api/services");
    expect(res.body.data.map((group: { number: string }) => group.number)).toEqual(["01", "02"]);
    expect(res.body.data[0].services).toHaveLength(4);
    expect(res.body.data[0].services[0]).toMatchObject({ title: "Property search & acquisition support", icon: "Search" });
  });

  it("creates sanitized drafts, publishes them and edits category text", async () => {
    const agent = await signedIn();
    const photo = await upload(agent);
    const created = await agent.post("/api/admin/services").send({
      category: "02",
      title: "Rent collection",
      description: '<p onclick="x()">Monthly <b>rent</b> collection<script>alert(1)</script><span style="color:red;font-size:18px">!</span></p>',
      image: { mediaId: photo.id, alt: "Keys" },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("draft");
    expect(created.body.data.description).toBe('<p>Monthly <b>rent</b> collection<span style="font-size:18px">!</span></p>');
    expect((await guest().get("/api/services")).body.data[1].services).toHaveLength(4);

    await agent.post(`/api/admin/services/${created.body.data.id}/publish`);
    const publicServices = (await guest().get("/api/services")).body.data[1].services;
    expect(publicServices.at(-1)).toMatchObject({ title: "Rent collection", image: { src: photo.src, alt: "Keys" } });
    expect(publicServices.at(-1).status).toBeUndefined();

    const category = await agent.patch("/api/admin/services/categories/02").send({ title: "Management" });
    expect(category.body.data.title).toBe("Management");
  });

  it("rejects empty descriptions and unknown categories", async () => {
    const agent = await signedIn();
    const empty = await agent.post("/api/admin/services").send({ category: "01", title: "X", description: "<p> </p>" });
    expect(empty.status).toBe(422);
    const category = await agent.post("/api/admin/services").send({ category: "09", title: "X", description: "Text" });
    expect(category.status).toBe(422);
  });

  it("reorders services", async () => {
    const agent = await signedIn();
    const list = (await agent.get("/api/admin/services").query({ category: "01" })).body.data as { id: string }[];
    const reversed = list.map((item) => item.id).reverse();
    expect((await agent.patch("/api/admin/services/reorder").send({ ids: reversed })).status).toBe(204);
    const after = (await agent.get("/api/admin/services").query({ category: "01" })).body.data as { id: string }[];
    expect(after.map((item) => item.id)).toEqual(reversed);
  });
});

describe("blogs", () => {
  beforeEach(() => resetDb({ seed: true }));

  it("serves seeded articles and hides drafts", async () => {
    const agent = await signedIn();
    const list = await guest().get("/api/blogs");
    expect(list.body.meta.total).toBe(3);
    expect(list.body.data[0].body).toBeUndefined();
    const article = await guest().get("/api/blogs/make-your-property-viewing-count");
    expect(article.body.data.body).toContain("<h2>Start with your everyday needs</h2>");

    const draft = await agent.post("/api/admin/blogs").send({ title: "Market update", body: "<p>Prices are steady.</p>" });
    expect(draft.status).toBe(201);
    expect(draft.body.data).toMatchObject({ slug: "market-update", status: "draft", excerpt: "Prices are steady.", author: "Jane Admin" });
    expect((await guest().get("/api/blogs/market-update")).status).toBe(404);
    await agent.post(`/api/admin/blogs/${draft.body.data.id}/publish`);
    expect((await guest().get("/api/blogs")).body.data[0].slug).toBe("market-update");
  });

  it("allows uploaded and https inline images with alt text only", async () => {
    const agent = await signedIn();
    const photo = await upload(agent);
    const ok = await agent.post("/api/admin/blogs").send({
      title: "Images",
      body: `<p>Hi</p><img src="${photo.src}" alt="Lounge"><img src="https://cdn.test/a.jpg" alt="Hall"><img src="data:image/png;base64,AAAA" alt="Inline">`,
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.body).toBe(`<p>Hi</p><img src="${photo.src}" alt="Lounge" /><img src="https://cdn.test/a.jpg" alt="Hall" />`);

    const noAlt = await agent.post("/api/admin/blogs").send({ title: "x", body: `<p>x</p><img src="${photo.src}">` });
    expect(noAlt.status).toBe(422);
    const many = Array.from({ length: 6 }, () => `<img src="${photo.src}" alt="a">`).join("");
    expect((await agent.post("/api/admin/blogs").send({ title: "x", body: `<p>x</p>${many}` })).status).toBe(422);
  });

  it("rejects non-image uploads and oversized files", async () => {
    const agent = await signedIn();
    const text = await agent.post("/api/admin/media").attach("file", Buffer.from("not an image"), "a.png");
    expect(text.status).toBe(422);
    const big = await agent.post("/api/admin/media").attach("file", Buffer.concat([PNG, Buffer.alloc(700 * 1024)]), "b.png");
    expect(big.status).toBe(422);
  });
});

describe("testimonials", () => {
  beforeEach(() => resetDb());

  it("accepts visitor feedback as pending and only shows approved entries", async () => {
    const submit = await guest().post("/api/testimonials").send({ name: "Amina", feedback: "Very helpful team.", rating: 5 });
    expect(submit.status).toBe(201);
    expect((await guest().get("/api/testimonials")).body.data).toHaveLength(0);

    const agent = await signedIn();
    const pending = await agent.get("/api/admin/testimonials").query({ status: "pending" });
    expect(pending.body.data).toHaveLength(1);
    expect(pending.body.data[0]).toMatchObject({ source: "visitor", status: "pending" });
    expect(pending.body.data[0].ipHash).toBeUndefined();

    const id = pending.body.data[0].id;
    await agent.patch(`/api/admin/testimonials/${id}`).send({ feedback: "Very helpful and professional team." });
    await agent.post(`/api/admin/testimonials/${id}/publish`);
    const published = await guest().get("/api/testimonials");
    expect(published.body.data).toEqual([
      expect.objectContaining({ name: "Amina", feedback: "Very helpful and professional team.", rating: 5 }),
    ]);
    expect(published.body.data[0].status).toBeUndefined();

    await agent.post(`/api/admin/testimonials/${id}/unpublish`);
    expect((await guest().get("/api/testimonials")).body.data).toHaveLength(0);
    expect((await agent.delete(`/api/admin/testimonials/${id}`)).status).toBe(204);
  });

  it("validates ratings and silently drops honeypot submissions", async () => {
    expect((await guest().post("/api/testimonials").send({ name: "A", feedback: "B", rating: 6 })).status).toBe(422);
    const bot = await guest().post("/api/testimonials").send({ name: "Bot", feedback: "Spam", rating: 5, website: "x.test" });
    expect(bot.status).toBe(201);
    const agent = await signedIn();
    expect((await agent.get("/api/admin/testimonials")).body.meta.total).toBe(0);
  });

  it("lets admins create published testimonials directly", async () => {
    const agent = await signedIn();
    const res = await agent
      .post("/api/admin/testimonials")
      .send({ name: "Peter", feedback: "Great service.", rating: 4, status: "published" });
    expect(res.body.data).toMatchObject({ source: "admin", status: "published" });
    expect((await guest().get("/api/testimonials")).body.data).toHaveLength(1);
  });
});

describe("dashboard and profile", () => {
  beforeEach(() => resetDb({ seed: true }));

  it("returns the counts the dashboard cards display", async () => {
    await guest().post("/api/testimonials").send({ name: "Amina", feedback: "Helpful.", rating: 5 });
    const res = await (await signedIn()).get("/api/admin/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      properties: { total: 5, published: 5, draft: 0, apartments: 2, houses: 3, byCategory: { unconfirmed: 5 } },
      services: { published: 8, draft: 0 },
      blogs: { published: 3, draft: 0 },
      testimonials: { pending: 1, draft: 0, published: 0 },
    });
    expect(res.body.data.recent.properties).toHaveLength(5);
    expect(res.body.data.recent.pendingTestimonials[0].name).toBe("Amina");
  });

  it("updates the profile without changing the sign-in email", async () => {
    const agent = await signedIn();
    const photo = await upload(agent);
    const res = await agent
      .patch("/api/admin/profile")
      .send({ displayName: "Jane Mwangi", contactEmail: "jane@contact.test", phone: "0701 507570", photoMediaId: photo.id });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      email: "admin@silverfox.test",
      displayName: "Jane Mwangi",
      contactEmail: "jane@contact.test",
      photo: { id: photo.id, src: photo.src },
    });
    expect((await agent.get("/api/auth/me")).body.user.displayName).toBe("Jane Mwangi");
    const bad = await agent.patch("/api/admin/profile").send({ contactEmail: "not-an-email" });
    expect(bad.status).toBe(422);
  });
});
