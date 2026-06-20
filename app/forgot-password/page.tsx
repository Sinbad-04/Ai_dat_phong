"use client";

import Link from "next/link";
import { useState } from "react";
import { readResponseBody } from "@/lib/http";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const { data, text } = await readResponseBody(response);
    const errorMessage =
      typeof data === "object" && data && "error" in data
        ? String((data as Record<string, unknown>).error || "Không gửi được yêu cầu")
        : text || "Không gửi được yêu cầu";
    if (!response.ok) {
      setError(errorMessage);
      return;
    }

    const configured =
      typeof data === "object" && data && "emailDeliveryConfigured" in data
        ? Boolean((data as Record<string, unknown>).emailDeliveryConfigured)
        : false;
    const serverMessage =
      typeof data === "object" && data && "message" in data
        ? String((data as Record<string, unknown>).message)
        : "Nếu email tồn tại, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.";
    setMessage(
      configured ? serverMessage : "Máy chủ chưa cấu hình dịch vụ email. Vui lòng liên hệ quản trị viên."
    );
  }

  return (
    <div className="container-px flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="font-display text-3xl">Quên mật khẩu</h1>
        <p className="mt-2 text-sm text-ink/60">Nhập email để nhận liên kết có hiệu lực trong 30 phút.</p>
        {message && <p className="mt-4 rounded-lg bg-jade/10 p-3 text-sm text-jade">{message}</p>}
        {error && <p className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</p>}
        <input
          className="field mt-5"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ban@email.com"
        />
        <button className="btn-primary mt-4 w-full" onClick={submit}>
          Gửi hướng dẫn
        </button>
        <Link href="/login" className="mt-4 block text-center text-sm text-teal">
          Quay lại đăng nhập
        </Link>
      </div>
    </div>
  );
}
