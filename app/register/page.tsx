"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readResponseBody } from "@/lib/http";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const { data, text } = await readResponseBody(res);
      const errorMessage =
        typeof data === "object" && data && "error" in data
          ? String((data as Record<string, unknown>).error || "Đăng ký thất bại")
          : text || "Đăng ký thất bại";
      if (!res.ok) throw new Error(errorMessage);
      router.push("/assistant");
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
        <span className="eyebrow">Bắt đầu</span>
        <h1 className="font-display text-3xl mt-2 mb-6">Tạo tài khoản</h1>

        {err && <div className="mb-4 text-sm text-coral bg-coral/10 rounded-lg px-3 py-2">{err}</div>}

        <div className="space-y-4">
          <div>
            <label className="label">Họ và tên</label>
            <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="field mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" />
          </div>
          <div>
            <label className="label">Mật khẩu</label>
            <input className="field mt-1" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Tối thiểu 8 ký tự" />
          </div>
          <button onClick={submit} disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Đang tạo…" : "Tạo tài khoản"}
          </button>
        </div>

        <p className="text-sm text-ink/60 mt-6 text-center">
          Đã có tài khoản? <Link href="/login" className="text-teal font-medium">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
