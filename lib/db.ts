// lib/db.ts
// Lớp truy cập dữ liệu. Có DATABASE_URL -> dùng Postgres (bền vững, dùng cho production).
// Không có -> dùng bộ nhớ tạm để chạy thử nhanh khi dev (KHÔNG bền vững, không dùng cho prod).
import postgres from "postgres";
import { ROOMS } from "./data/knowledge";

export type Role = "user" | "admin";

export type User = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  created_at: string;
};

export type Booking = {
  id: string;
  user_id: string;
  room_id: string;
  room_name: string;
  check_in: string;
  check_out: string;
  guests: number;
  package_id: string | null;
  nights: number;
  total_price: number;
  deposit: number;
  currency: string;
  source: "static" | "liteapi";
  provider_ref: string | null;   // prebookId của LiteAPI
  transaction_id: string | null; // transactionId của Payment SDK
  status: "payment_pending" | "pending" | "confirmed" | "cancelled";
  notes: string | null;
  created_at: string;
};

const HAS_DB = !!process.env.DATABASE_URL;

// ---- Kết nối Postgres (singleton, an toàn cho serverless) ----
let sql: ReturnType<typeof postgres> | null = null;
function db() {
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL as string, {
      ssl: "require",
      max: 1,
      idle_timeout: 20,
    });
  }
  return sql;
}

// ---- Bộ nhớ tạm (dev fallback) ----
const g = globalThis as unknown as {
  __mem?: { users: User[]; bookings: Booking[]; ready: boolean };
};
function mem() {
  if (!g.__mem) g.__mem = { users: [], bookings: [], ready: false };
  return g.__mem;
}

export function usingMemory() {
  return !HAS_DB;
}

function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

// ---- Khởi tạo schema ----
export async function ensureSchema() {
  if (!HAS_DB) {
    mem().ready = true;
    return;
  }
  const s = db();
  await s`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await s`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room_id TEXT NOT NULL,
      room_name TEXT NOT NULL,
      check_in DATE NOT NULL,
      check_out DATE NOT NULL,
      guests INT NOT NULL,
      package_id TEXT,
      nights INT NOT NULL,
      total_price BIGINT NOT NULL,
      deposit BIGINT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'VND',
      source TEXT NOT NULL DEFAULT 'static',
      provider_ref TEXT,
      transaction_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Di trú nhẹ cho DB đã tạo từ trước (idempotent)
  await s`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'VND'`;
  await s`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'static'`;
  await s`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_ref TEXT`;
  await s`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_id TEXT`;
  await s`ALTER TABLE bookings ALTER COLUMN room_id DROP NOT NULL`;
  await s`ALTER TABLE bookings ALTER COLUMN package_id DROP NOT NULL`;
}

// ---- Users ----
export async function getUserByEmail(email: string): Promise<User | null> {
  if (!HAS_DB) {
    return mem().users.find((u) => u.email === email.toLowerCase()) ?? null;
  }
  const rows = await db()<User[]>`SELECT * FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  if (!HAS_DB) {
    return mem().users.find((u) => u.id === id) ?? null;
  }
  const rows = await db()<User[]>`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  name: string;
  password_hash: string;
  role?: Role;
}): Promise<User> {
  const user: User = {
    id: uid(),
    email: input.email.toLowerCase(),
    name: input.name,
    password_hash: input.password_hash,
    role: input.role ?? "user",
    created_at: new Date().toISOString(),
  };
  if (!HAS_DB) {
    mem().users.push(user);
    return user;
  }
  await db()`
    INSERT INTO users (id, email, name, password_hash, role)
    VALUES (${user.id}, ${user.email}, ${user.name}, ${user.password_hash}, ${user.role})`;
  return user;
}

export async function listUsers(): Promise<User[]> {
  if (!HAS_DB) return [...mem().users].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return db()<User[]>`SELECT * FROM users ORDER BY created_at DESC`;
}

// ---- Bookings ----
export async function createBooking(b: Omit<Booking, "id" | "created_at">): Promise<Booking> {
  const booking: Booking = { ...b, id: uid(), created_at: new Date().toISOString() };
  if (!HAS_DB) {
    mem().bookings.push(booking);
    return booking;
  }
  await db()`
    INSERT INTO bookings
      (id, user_id, room_id, room_name, check_in, check_out, guests, package_id, nights, total_price, deposit, currency, source, provider_ref, transaction_id, status, notes)
    VALUES
      (${booking.id}, ${booking.user_id}, ${booking.room_id}, ${booking.room_name},
       ${booking.check_in}, ${booking.check_out}, ${booking.guests}, ${booking.package_id},
       ${booking.nights}, ${booking.total_price}, ${booking.deposit}, ${booking.currency},
       ${booking.source}, ${booking.provider_ref}, ${booking.transaction_id},
       ${booking.status}, ${booking.notes})`;
  return booking;
}

export async function listBookingsByUser(userId: string): Promise<Booking[]> {
  if (!HAS_DB)
    return mem()
      .bookings.filter((x) => x.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return db()<Booking[]>`SELECT * FROM bookings WHERE user_id = ${userId} ORDER BY created_at DESC`;
}

export async function listAllBookings(): Promise<(Booking & { user_email: string })[]> {
  if (!HAS_DB) {
    const m = mem();
    return m.bookings
      .map((bk) => ({
        ...bk,
        user_email: m.users.find((u) => u.id === bk.user_id)?.email ?? "?",
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return db()<(Booking & { user_email: string })[]>`
    SELECT b.*, u.email AS user_email
    FROM bookings b JOIN users u ON u.id = b.user_id
    ORDER BY b.created_at DESC`;
}

export async function setBookingStatus(
  id: string,
  status: Booking["status"]
): Promise<void> {
  if (!HAS_DB) {
    const bk = mem().bookings.find((x) => x.id === id);
    if (bk) bk.status = status;
    return;
  }
  await db()`UPDATE bookings SET status = ${status} WHERE id = ${id}`;
}

// Tìm đơn theo transactionId (dùng khi xác nhận sau thanh toán LiteAPI)
export async function getBookingByTransactionId(
  txId: string,
  userId: string
): Promise<Booking | null> {
  if (!HAS_DB) {
    return (
      mem().bookings.find((b) => b.transaction_id === txId && b.user_id === userId) ?? null
    );
  }
  const rows = await db()<Booking[]>`
    SELECT * FROM bookings WHERE transaction_id = ${txId} AND user_id = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

// Chốt đơn sau khi LiteAPI book thành công
export async function finalizeBooking(
  id: string,
  confirmation: string | null
): Promise<void> {
  if (!HAS_DB) {
    const bk = mem().bookings.find((x) => x.id === id);
    if (bk) {
      bk.status = "confirmed";
      bk.notes = confirmation ? `Mã xác nhận: ${confirmation}` : bk.notes;
    }
    return;
  }
  await db()`
    UPDATE bookings
    SET status = 'confirmed', notes = COALESCE(${confirmation ? `Mã xác nhận: ${confirmation}` : null}, notes)
    WHERE id = ${id}`;
}

// Tiện ích: tìm phòng theo id (từ knowledge base)
export function findRoom(roomId: string) {
  return ROOMS.find((r) => r.id === roomId) ?? null;
}
