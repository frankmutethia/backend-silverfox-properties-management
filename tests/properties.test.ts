import { beforeEach, describe, expect, it } from "vitest";
import { guest, resetDb, signedIn, upload } from "./helpers.js";

beforeEach(() => resetDb());

const listing = (mediaId?: string) => ({
  name: "Riverside Apartment",
  reference: "SF-100",
  category: "rent",
  type: "Apartment",
  location: "Kilimani, Nairobi",
  neighbourhood: "Near Yaya Centre",
  description: "Two-bedroom apartment with a balcony.",
  price: { amount: 85000, currency: "KES", period: "month" },
  bedrooms: 2,
  bathrooms: 2,
  areaSqm: 110.5,
  amenities: ["Parking", "Balcony"],
  images: mediaId ? [{ mediaId, alt: "Living room", position: "50% 50%" }] : [],
});

describe("properties", () => {
  it("creates a draft that stays off the public site until published", async () => {
    const agent = await signedIn();
    const photo = await upload(agent);
    const created = await agent.post("/api/admin/properties").send(listing(photo.id));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      slug: "riverside-apartment",
      status: "draft",
      price: { amount: 85000, currency: "KES", period: "month" },
      areaSqm: 110.5,
    });
    expect(created.body.data.images[0]).toMatchObject({ mediaId: photo.id, src: photo.src, alt: "Living room" });

    expect((await guest().get("/api/properties")).body.data).toHaveLength(0);
    expect((await guest().get("/api/properties/riverside-apartment")).status).toBe(404);

    const published = await agent.post(`/api/admin/properties/${created.body.data.id}/publish`);
    expect(published.body.data.status).toBe("published");
    const detail = await guest().get("/api/properties/riverside-apartment");
    expect(detail.status).toBe(200);
    expect(detail.body.data.images).toEqual([{ src: photo.src, alt: "Living room", position: "50% 50%" }]);
    expect(detail.body.data.id).toBeUndefined();
    expect(detail.body.data.status).toBeUndefined();

    await agent.post(`/api/admin/properties/${created.body.data.id}/unpublish`);
    expect((await guest().get("/api/properties/riverside-apartment")).status).toBe(404);
  });

  it("requires at least one photo to publish", async () => {
    const agent = await signedIn();
    const draft = await agent.post("/api/admin/properties").send(listing());
    expect(draft.status).toBe(201);
    const publish = await agent.post(`/api/admin/properties/${draft.body.data.id}/publish`);
    expect(publish.status).toBe(422);
    const direct = await agent.post("/api/admin/properties").send({ ...listing(), reference: "SF-101", status: "published" });
    expect(direct.status).toBe(422);
  });

  it("applies the category price rules", async () => {
    const agent = await signedIn();
    const managed = await agent
      .post("/api/admin/properties")
      .send({ ...listing(), category: "managed", reference: "SF-1" });
    expect(managed.body.data.price).toBeNull();
    const sale = await agent
      .post("/api/admin/properties")
      .send({ ...listing(), category: "sale", reference: "SF-2", price: { amount: 9_000_000, period: "month" } });
    expect(sale.body.data.price).toEqual({ amount: 9_000_000, currency: "KES", period: "" });
    const rent = await agent
      .post("/api/admin/properties")
      .send({ ...listing(), reference: "SF-3", price: { amount: 50_000, period: "" } });
    expect(rent.status).toBe(422);
    expect(rent.body.errors["price.period"]).toBeDefined();
  });

  it("rejects duplicate references and generates unique slugs", async () => {
    const agent = await signedIn();
    await agent.post("/api/admin/properties").send(listing());
    const duplicate = await agent.post("/api/admin/properties").send(listing());
    expect(duplicate.status).toBe(422);
    expect(duplicate.body.errors.reference).toBeDefined();
    const second = await agent.post("/api/admin/properties").send({ ...listing(), reference: "SF-200" });
    expect(second.body.data.slug).toBe("riverside-apartment-2");
  });

  it("validates required fields and photo limits", async () => {
    const agent = await signedIn();
    const res = await agent.post("/api/admin/properties").send({ name: "", type: "Castle" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors)).toEqual(
      expect.arrayContaining(["name", "reference", "category", "type", "location", "description"]),
    );
    const photo = await upload(agent);
    const tooMany = await agent
      .post("/api/admin/properties")
      .send({ ...listing(), images: Array.from({ length: 6 }, () => ({ mediaId: photo.id, alt: "x" })) });
    expect(tooMany.status).toBe(422);
    const missing = await agent
      .post("/api/admin/properties")
      .send({ ...listing(), images: [{ mediaId: "does-not-exist", alt: "x" }] });
    expect(missing.status).toBe(422);
  });

  it("updates fields, replaces photos in order, filters and deletes", async () => {
    const agent = await signedIn();
    const first = await upload(agent);
    const second = await upload(agent);
    const { body } = await agent.post("/api/admin/properties").send(listing(first.id));
    const id = body.data.id;

    const updated = await agent.patch(`/api/admin/properties/${id}`).send({
      location: "Westlands",
      category: "managed",
      images: [
        { mediaId: second.id, alt: "Cover" },
        { mediaId: first.id, alt: "Kitchen" },
      ],
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.location).toBe("Westlands");
    expect(updated.body.data.price).toBeNull();
    expect(updated.body.data.images.map((image: { alt: string }) => image.alt)).toEqual(["Cover", "Kitchen"]);
    expect(updated.body.data.slug).toBe("riverside-apartment");

    const filtered = await agent.get("/api/admin/properties").query({ q: "SF-100", category: "managed" });
    expect(filtered.body.meta.total).toBe(1);
    expect((await agent.get("/api/admin/properties").query({ status: "published" })).body.meta.total).toBe(0);

    expect((await agent.delete(`/api/admin/properties/${id}`)).status).toBe(204);
    expect((await agent.get(`/api/admin/properties/${id}`)).status).toBe(404);
  });

  it("serves the seeded website listings in their original order", async () => {
    await resetDb({ seed: true });
    const res = await guest().get("/api/properties");
    expect(res.body.data.map((item: { reference: string }) => item.reference)).toEqual([
      "SF-004",
      "SF-005",
      "SF-001",
      "SF-002",
      "SF-003",
    ]);
    expect(res.body.data[0]).toMatchObject({ category: null, location: null, price: null, amenities: [] });
    expect(res.body.data[0].images[0].src).toMatch(/^http:\/\/api\.test\/uploads\//);
  });
});
