"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "Không đặt lại được mật khẩu");
    router.push("/login");
  }

  return (
    <div className="card w-full max-w-md p-8">
      <h1 className="font-display text-3xl">Đặt mật khẩu mới</h1>
      {error && <p className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</p>}
      <input className="field mt-5" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tối thiểu 8 ký tự" />
      <button className="btn-primary mt-4 w-full" onClick={submit} disabled={!token}>Cập nhật mật khẩu</button>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <div className="container-px flex justify-center py-16"><Suspense fallback="Đang tải…"><ResetForm /></Suspense></div>;
}

