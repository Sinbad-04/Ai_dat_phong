import test from "node:test";
import assert from "node:assert/strict";
import {
  declinesAreaPreference,
  declinesBudgetFilter,
  asksAboutDestinationHighlights,
  asksForRoomRecommendation,
  hasExplicitTripPurpose,
  isGreetingOnly,
  parseGuests,
  parseMaxNightlyBudget,
  parseStayDates,
  wantsDifferentArea,
} from "../lib/travel-query";
import { detectDestinationArea, hotelMatchesArea } from "../lib/data/destinations";

test("recognizes short greetings without treating normal requests as greetings", () => {
  assert.equal(isGreetingOnly("Hi"), true);
  assert.equal(isGreetingOnly("Xin chào bạn!"), true);
  assert.equal(isGreetingOnly("Chào, tôi muốn đi Hà Nội"), false);
});

test("recognizes optional search filters being skipped", () => {
  assert.equal(declinesAreaPreference("Khu nào cũng được"), true);
  assert.equal(declinesBudgetFilter("Xem tất cả mức giá"), true);
});

test("only recognizes explicit trip purposes and room requests", () => {
  assert.equal(hasExplicitTripPurpose("Tôi đi nghỉ dưỡng cùng gia đình"), true);
  assert.equal(hasExplicitTripPurpose("Bạn có thể làm gì?"), false);
  assert.equal(asksForRoomRecommendation("Gợi ý phòng phù hợp giúp tôi"), true);
  assert.equal(asksForRoomRecommendation("Gợi ý điểm đến"), false);
});

test("recognizes destination follow-up questions", () => {
  assert.equal(asksAboutDestinationHighlights("Ở đây có gì đẹp?"), true);
  assert.equal(wantsDifferentArea("Chỗ khác đi"), true);
});

test("detects and matches specific hotel areas", () => {
  const area = detectDestinationArea("Tôi muốn ở gần Hồ Tây");
  assert.equal(area?.value, "ho-tay");
  assert.equal(hotelMatchesArea({ address: "12 phố Quảng An, Tây Hồ" }, area!), true);
  assert.equal(hotelMatchesArea({ address: "Phố Huế, Hai Bà Trưng" }, area!), false);
});

test("parses common Vietnamese nightly budgets", () => {
  assert.equal(parseMaxNightlyBudget("giá < 1 triệu"), 1_000_000);
  assert.equal(parseMaxNightlyBudget("dưới 900k"), 900_000);
  assert.equal(parseMaxNightlyBudget("không quá 1,5tr"), 1_500_000);
});

test("parses guest count", () => {
  assert.equal(parseGuests("đi Nha Trang 4 người"), 4);
  assert.equal(parseGuests("20 khách"), null);
});

test("parses ISO and Vietnamese date ranges", () => {
  assert.deepEqual(parseStayDates("từ 2099-07-10 đến 2099-07-12"), {
    checkIn: "2099-07-10",
    checkOut: "2099-07-12",
  });
  assert.deepEqual(parseStayDates("từ 10/07/2099 đến 12/07/2099"), {
    checkIn: "2099-07-10",
    checkOut: "2099-07-12",
  });
  assert.deepEqual(parseStayDates("10 - 12/7/2099"), {
    checkIn: "2099-07-10",
    checkOut: "2099-07-12",
  });
  assert.deepEqual(parseStayDates("10 - 12/7", new Date("2026-06-21T00:00:00Z")), {
    checkIn: "2026-07-10",
    checkOut: "2026-07-12",
  });
});
