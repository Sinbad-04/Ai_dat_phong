import assert from "node:assert/strict";
import test from "node:test";
import { buildConciergeContext, conciergeContextSchema } from "../lib/concierge-context";

test("normalizes a multi-turn hotel request into validated JSON context", () => {
  const context = buildConciergeContext([
    { role: "user", content: "Tôi muốn đi Hà Nội" },
    { role: "assistant", content: "Bạn muốn ở khu vực nào?" },
    { role: "user", content: "Hồ Tây" },
    { role: "assistant", content: "Bạn đi ngày nào?" },
    { role: "user", content: "10/07/2027 đến 12/07/2027" },
    { role: "assistant", content: "Có bao nhiêu khách?" },
    { role: "user", content: "2 người" },
    { role: "assistant", content: "Ngân sách mỗi đêm?" },
    { role: "user", content: "Không quá 2 triệu/đêm" },
  ]);

  assert.equal(context.destination?.label, "Hà Nội");
  assert.equal(context.area?.label, "Hồ Tây");
  assert.deepEqual(context.stay, { checkIn: "2027-07-10", checkOut: "2027-07-12" });
  assert.equal(context.guests, 2);
  assert.equal(context.maxNightlyBudget, 2_000_000);
  assert.deepEqual(context.missingSlots, []);
  assert.equal(conciergeContextSchema.safeParse(context).success, true);
});

test("keeps only the latest ten turns sent to the model", () => {
  const messages = Array.from({ length: 14 }, (_, index) => ({
    role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `turn ${index}`,
  }));
  const context = buildConciergeContext(messages);

  assert.equal(context.recentTurns.length, 10);
  assert.equal(context.recentTurns[0].content, "turn 4");
  assert.equal(context.recentTurns.at(-1)?.content, "turn 13");
});

test("a new destination does not retain an area from the previous destination", () => {
  const context = buildConciergeContext([
    { role: "user", content: "Tìm khách sạn ở Phú Quốc" },
    { role: "user", content: "Bãi Trường" },
    { role: "user", content: "Đổi sang Hà Nội" },
  ]);

  assert.equal(context.destination?.label, "Hà Nội");
  assert.equal(context.area, null);
  assert.equal(context.missingSlots.includes("area"), true);
});

test("extracts relative dates from the original request and allows a later topic switch", () => {
  const bookingContext = buildConciergeContext(
    [{ role: "user", content: "Tôi muốn book 1 phòng 2 người tới Đà Nẵng trong 2 ngày bắt đầu từ ngày 22 tháng này" }],
    { now: new Date("2026-06-22T00:00:00Z") }
  );
  assert.equal(bookingContext.guests, 2);
  assert.deepEqual(bookingContext.stay, { checkIn: "2026-06-22", checkOut: "2026-06-24" });
  assert.equal(bookingContext.intent, "hotel_search");

  const switchedContext = buildConciergeContext([
    { role: "user", content: "Tôi muốn tìm khách sạn ở Đà Nẵng" },
    { role: "assistant", content: "Bạn muốn nhận phòng ngày nào?" },
    { role: "user", content: "Bạn có biết lập trình không?" },
  ]);
  assert.equal(switchedContext.destination?.label, "Đà Nẵng");
  assert.equal(switchedContext.intent, "out_of_scope");
  assert.equal(switchedContext.flags.topicChanged, true);
});

test("keeps an explicit request to change area in the hotel-search flow", () => {
  const context = buildConciergeContext([
    { role: "user", content: "Đà Nẵng có gì hay?" },
    { role: "assistant", content: "Bạn muốn ở khu vực nào?" },
    { role: "user", content: "Trung tâm Hải Châu" },
    { role: "assistant", content: "Hải Châu thuận tiện ăn uống và mua sắm." },
    { role: "user", content: "Chỗ khác đi" },
  ]);

  assert.equal(context.intent, "hotel_search");
  assert.equal(context.flags.wantsDifferentArea, true);
  assert.equal(context.area?.value, "hai-chau");
});
