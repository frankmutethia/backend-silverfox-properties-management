import test from "node:test";
import assert from "node:assert/strict";
import { guest, signedIn, useTestApp } from "./helpers.js";
useTestApp();
test("public submissions are saved privately and visible to authenticated staff", async () => {
  await guest().get("/api/v1/enquiries").expect(401);
  await guest().post("/api/v1/enquiries").send({ name: " ", message: "Hello" }).expect(400);
  const response = await guest().post("/api/v1/enquiries").send({ name: "Client", message: "Please explain your management services.", emailStatus: "sent" }).expect(201);
  assert.deepEqual(response.body.data, {});
  const staff = await signedIn();
  const list = await staff.get("/api/v1/enquiries").expect(200);
  const enquiry = list.body.data.enquiries.find(item => item.name === "Client");
  assert.equal(enquiry.message, "Please explain your management services.");
  assert.notEqual(enquiry.emailStatus, "sent");
  await guest().post(`/api/v1/enquiries/${enquiry._id}/retry-email`).expect(401);
  const retried = await staff.post(`/api/v1/enquiries/${enquiry._id}/retry-email`).expect(200);
  // The test server has no SMTP settings, so staff see exactly why the email was not sent.
  assert.equal(retried.body.data.enquiry.emailStatus, "failed");
  assert.equal(retried.body.data.enquiry.emailError, "Email sending isn't set up on the server yet (SMTP settings are missing).");
});
