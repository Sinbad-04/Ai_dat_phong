// lib/bootstrap.ts
// Đảm bảo bảng tồn tại và có 1 tài khoản admin. Gọi idempotent (chạy nhiều lần vẫn an toàn).
import { ensureSchema, getUserByEmail, createUser } from "./db";
import { hashPassword } from "./auth";
import { adminConfig } from "./env";

let done: Promise<void> | null = null;

export function bootstrap(): Promise<void> {
  if (!done) {
    done = (async () => {
      await ensureSchema();
      let email: string;
      let password: string;
      try {
        ({ email, password } = adminConfig());
      } catch (error) {
        console.warn("[bootstrap] Skipping admin seed:", error instanceof Error ? error.message : error);
        return;
      }
      const existing = await getUserByEmail(email);
      if (!existing) {
        await createUser({
          email,
          name: "Quản trị viên",
          password_hash: await hashPassword(password),
          role: "admin",
        });
        console.log(`[bootstrap] Đã tạo admin: ${email}`);
      }
    })().catch((e) => {
      done = null; // cho phép thử lại nếu lỗi
      throw e;
    });
  }
  return done;
}
