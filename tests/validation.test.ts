import test from "node:test";
import assert from "node:assert/strict";
import { validateStayDates } from "../lib/validation";

test("validateStayDates accepts a valid future stay", () => {
  assert.deepEqual(validateStayDates("2099-07-10", "2099-07-12"), { nights: 2 });
});

test("validateStayDates rejects reversed, invalid and overly long stays", () => {
  assert.match(validateStayDates("2099-07-12", "2099-07-10").error || "", /sau ngày nhận/);
  assert.match(validateStayDates("2099-02-30", "2099-03-02").error || "", /không hợp lệ/);
  assert.match(validateStayDates("2099-01-01", "2099-03-01").error || "", /tối đa/);
});

test("validateStayDates rejects past check-in", () => {
  assert.match(validateStayDates("2020-01-01", "2020-01-02").error || "", /quá khứ/);
});

