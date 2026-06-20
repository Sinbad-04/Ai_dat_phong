import test from "node:test";
import assert from "node:assert/strict";
import { parseGuests, parseMaxNightlyBudget, parseStayDates } from "../lib/travel-query";

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
});

