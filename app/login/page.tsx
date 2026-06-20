"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { readResponseBody } from "@/lib/http";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedNext = params.get("next") || "/assistant";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/assistant";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const { data, text } = await readResponseBody(res);
      const errorMessage =
        typeof data === "object" && data && "error" in data
          ? String((data as Record<string, unknown>).error || "Đăng nhập thất bại")
          : text || "Đăng nhập thất bại";
      if (!res.ok) throw new Error(errorMessage);
      router.push(next);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-px py-16 flex justify-center">
      <div className="card p-8 w-full max-w-md">
        <span className="eyebrow">Chào mừng trở lại</span>
        <h1 className="font-display text-3xl mt-2 mb-6">Đăng nhập</h1>

        {err && <div className="mb-4 text-sm text-coral bg-coral/10 rounded-lg px-3 py-2">{err}</div>}

        <div className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="field mt-1" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="ban@email.com" />
          </div>
          <div>
            <label className="label">Mật khẩu</label>
            <input className="field mt-1" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••" />
          </div>
          <button onClick={submit} disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <Link href="/forgot-password" className="block text-center text-sm text-teal">Quên mật khẩu?</Link>
        </div>

        <p className="text-sm text-ink/60 mt-6 text-center">
          Chưa có tài khoản? <Link href="/register" className="text-teal font-medium">Tạo ngay</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-px py-16 text-center text-ink/50">Đang tải…</div>}>
      <LoginInner />
    </Suspense>
  );
}
