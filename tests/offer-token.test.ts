import test from "node:test";
import assert from "node:assert/strict";
import { createOfferToken, verifyOfferToken } from "../lib/offer-token";

test("offer metadata is signed and tampered tokens are rejected", async () => {
  process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  const offer = {
    offerId: "offer-1", hotelId: "hotel-1", name: "Hotel",
    roomDescription: "Deluxe", checkIn: "2099-07-10", checkOut: "2099-07-12", guests: 2,
  };
  const token = await createOfferToken(offer);
  assert.deepEqual(await verifyOfferToken(token), offer);
  const parts = token.split(".");
  parts[1] = `${parts[1][0] === "A" ? "B" : "A"}${parts[1].slice(1)}`;
  assert.equal(await verifyOfferToken(parts.join(".")), null);
});
