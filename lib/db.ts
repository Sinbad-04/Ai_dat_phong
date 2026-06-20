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

type PasswordResetToken = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
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
  __mem?: { users: User[]; bookings: Booking[]; resetTokens: PasswordResetToken[]; ready: boolean };
};
function mem() {
  if (!g.__mem) g.__mem = { users: [], bookings: [], resetTokens: [], ready: false };
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
  await s`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Di trú nhẹ cho DB đã tạo từ trước (idempotent)
  await s`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'VND'`;
  await s`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'static'`;
  await s`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_ref TEXT`;
  await s`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_id TEXT`;
  await s`ALTER TABLE bookings ALTER COLUMN room_id DROP NOT NULL`;
  await s`ALTER TABLE bookings ALTER COLUMN package_id DROP NOT NULL`;
  await s`CREATE UNIQUE INDEX IF NOT EXISTS bookings_transaction_id_unique ON bookings(transaction_id) WHERE transaction_id IS NOT NULL`;
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

export async function updateUserRole(id: string, role: Role): Promise<boolean> {
  if (!HAS_DB) {
    const user = mem().users.find((item) => item.id === id);
    if (!user) return false;
    user.role = role;
    return true;
  }
  const rows = await db()<User[]>`UPDATE users SET role = ${role} WHERE id = ${id} RETURNING *`;
  return rows.length > 0;
}

export async function createPasswordResetToken(
  email: string,
  tokenHash: string,
  expiresAt: string
): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  if (!HAS_DB) {
    mem().resetTokens = mem().resetTokens.filter(
      (token) => token.user_id !== user.id && token.expires_at > new Date().toISOString()
    );
    mem().resetTokens.push({
      id: uid(), user_id: user.id, token_hash: tokenHash, expires_at: expiresAt, used_at: null,
    });
    return user;
  }
  await db()`DELETE FROM password_reset_tokens WHERE user_id = ${user.id} OR expires_at < now()`;
  await db()`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
    VALUES (${uid()}, ${user.id}, ${tokenHash}, ${expiresAt})`;
  return user;
}

export async function consumePasswordResetToken(
  tokenHash: string,
  passwordHash: string
): Promise<boolean> {
  if (!HAS_DB) {
    const token = mem().resetTokens.find(
      (item) => item.token_hash === tokenHash && !item.used_at && item.expires_at > new Date().toISOString()
    );
    if (!token) return false;
    const user = mem().users.find((item) => item.id === token.user_id);
    if (!user) return false;
    user.password_hash = passwordHash;
    token.used_at = new Date().toISOString();
    return true;
  }
  return db().begin(async (tx) => {
    const rows = await tx<PasswordResetToken[]>`
      SELECT * FROM password_reset_tokens
      WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
      FOR UPDATE LIMIT 1`;
    const token = rows[0];
    if (!token) return false;
    await tx`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${token.user_id}`;
    await tx`UPDATE password_reset_tokens SET used_at = now() WHERE id = ${token.id}`;
    return true;
  });
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

export async function countOverlappingBookings(
  roomId: string,
  checkIn: string,
  checkOut: string
): Promise<number> {
  if (!HAS_DB) {
    return mem().bookings.filter(
      (booking) =>
        booking.room_id === roomId &&
        booking.status !== "cancelled" &&
        booking.check_in < checkOut &&
        booking.check_out > checkIn
    ).length;
  }
  const rows = await db()<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM bookings
    WHERE room_id = ${roomId}
      AND status <> 'cancelled'
      AND check_in < ${checkOut}::date
      AND check_out > ${checkIn}::date`;
  return rows[0]?.count ?? 0;
}

export async function createStaticBookingIfAvailable(
  input: Omit<Booking, "id" | "created_at">,
  inventory: number
): Promise<Booking | null> {
  if (!HAS_DB) {
    const occupied = await countOverlappingBookings(input.room_id, input.check_in, input.check_out);
    return occupied >= inventory ? null : createBooking(input);
  }

  return db().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${input.room_id}))`;
    const rows = await tx<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM bookings
      WHERE room_id = ${input.room_id}
        AND status <> 'cancelled'
        AND check_in < ${input.check_out}::date
        AND check_out > ${input.check_in}::date`;
    if ((rows[0]?.count ?? 0) >= inventory) return null;

    const booking: Booking = { ...input, id: uid(), created_at: new Date().toISOString() };
    await tx`
      INSERT INTO bookings
        (id, user_id, room_id, room_name, check_in, check_out, guests, package_id, nights, total_price, deposit, currency, source, provider_ref, transaction_id, status, notes)
      VALUES
        (${booking.id}, ${booking.user_id}, ${booking.room_id}, ${booking.room_name},
         ${booking.check_in}, ${booking.check_out}, ${booking.guests}, ${booking.package_id},
         ${booking.nights}, ${booking.total_price}, ${booking.deposit}, ${booking.currency},
         ${booking.source}, ${booking.provider_ref}, ${booking.transaction_id},
         ${booking.status}, ${booking.notes})`;
    return booking;
  });
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
): Promise<boolean> {
  if (!HAS_DB) {
    const bk = mem().bookings.find((x) => x.id === id);
    if (!bk) return false;
    bk.status = status;
    return true;
  }
  const rows = await db()<Booking[]>`UPDATE bookings SET status = ${status} WHERE id = ${id} RETURNING *`;
  return rows.length > 0;
}

export async function getBookingById(id: string): Promise<Booking | null> {
  if (!HAS_DB) return mem().bookings.find((booking) => booking.id === id) ?? null;
  const rows = await db()<Booking[]>`SELECT * FROM bookings WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function cancelBookingByUser(id: string, userId: string): Promise<Booking | null> {
  if (!HAS_DB) {
    const booking = mem().bookings.find((item) => item.id === id && item.user_id === userId);
    if (!booking || !["pending", "payment_pending"].includes(booking.status)) return null;
    booking.status = "cancelled";
    return booking;
  }
  const rows = await db()<Booking[]>`
    UPDATE bookings SET status = 'cancelled'
    WHERE id = ${id} AND user_id = ${userId} AND status IN ('pending', 'payment_pending')
    RETURNING *`;
  return rows[0] ?? null;
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
