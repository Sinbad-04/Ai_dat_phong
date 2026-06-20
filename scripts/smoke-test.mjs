const base = process.env.SMOKE_BASE_URL || "http://localhost:3100";

async function request(path, options = {}, cookie = "") {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${base}${path}`, { ...options, headers, redirect: "manual" });
  let body = null;
  const text = await response.text();
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie };
}

function expect(result, status, label) {
  if (result.response.status !== status) {
    throw new Error(`${label}: expected ${status}, got ${result.response.status}: ${JSON.stringify(result.body)}`);
  }
  console.log(`PASS ${label} (${status})`);
}

const home = await request("/");
expect(home, 200, "home page");
expect(await request("/assistant"), 307, "protected page redirects anonymous user");
expect(await request("/api/health"), 200, "development health endpoint");
expect(await request("/api/rooms"), 200, "room catalogue");
expect(await request("/api/hotels?dest=Nha%20Trang%7CVN&checkin=2099-07-12&checkout=2099-07-10&adults=2"), 400, "hotel search rejects reversed dates");

const email = `smoke-${Date.now()}@example.com`;
const registered = await request("/api/auth/register", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Smoke Test", email, password: "Secret123" }),
});
expect(registered, 200, "register");
const userCookie = registered.cookie;
expect(await request("/api/auth/me", {}, userCookie), 200, "authenticated session");

expect(await request("/api/bookings", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ roomId: "deluxe-garden", checkIn: "2020-01-01", checkOut: "2020-01-02", guests: 2 }),
}, userCookie), 400, "booking rejects past dates");

expect(await request("/api/bookings", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ roomId: "deluxe-garden", checkIn: "2099-07-10", checkOut: "2099-07-12", guests: 2, packageId: "invalid" }),
}, userCookie), 400, "booking rejects unknown package");

let firstBooking;
const createdBookings = [];
for (let index = 0; index < 8; index += 1) {
  const booked = await request("/api/bookings", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomId: "deluxe-garden", checkIn: "2099-07-10", checkOut: "2099-07-12", guests: 2 }),
  }, userCookie);
  expect(booked, 200, `inventory booking ${index + 1}/8`);
  firstBooking ||= booked.body.booking;
  createdBookings.push(booked.body.booking);
}
expect(await request("/api/bookings", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ roomId: "deluxe-garden", checkIn: "2099-07-10", checkOut: "2099-07-12", guests: 2 }),
}, userCookie), 409, "inventory prevents overbooking");

expect(await request("/api/bookings", {
  method: "PATCH", headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: firstBooking.id }),
}, userCookie), 200, "user cancels pending booking");
expect(await request("/api/admin/users", {}, userCookie), 403, "user cannot access admin API");
expect(await request("/api/auth/forgot-password", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "missing@example.com" }),
}), 200, "password reset does not reveal account existence");

const admin = await request("/api/auth/login", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@resort.vn", password: "Admin@12345" }),
});
expect(admin, 200, "development admin login");
expect(await request("/api/admin/users", {}, admin.cookie), 200, "admin API");
expect(await request("/api/admin/bookings", {
  method: "PATCH", headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: createdBookings[1].id, status: "confirmed" }),
}, admin.cookie), 200, "admin confirms pending booking");
expect(await request("/api/admin/bookings", {
  method: "PATCH", headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: createdBookings[1].id, status: "cancelled" }),
}, admin.cookie), 409, "invalid booking status transition is rejected");

console.log("Smoke test completed successfully.");
