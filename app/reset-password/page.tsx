"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { readResponseBody } from "@/lib/http";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const { data, text } = await readResponseBody(response);
    const errorMessage =
      typeof data === "object" && data && "error" in data
        ? String((data as Record<string, unknown>).error || "Không đặt lại được mật khẩu")
        : text || "Không đặt lại được mật khẩu";
    if (!response.ok) {
      setError(errorMessage);
      return;
    }
    router.push("/login");
  }

  return (
    <div className="card w-full max-w-md p-8">
      <h1 className="font-display text-3xl">Đặt mật khẩu mới</h1>
      {error && <p className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</p>}
      <input
        className="field mt-5"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Tối thiểu 8 ký tự"
      />
      <button className="btn-primary mt-4 w-full" onClick={submit} disabled={!token}>
        Cập nhật mật khẩu
      </button>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container-px flex justify-center py-16">
      <Suspense fallback="Đang tải...">
        <ResetForm />
      </Suspense>
    </div>
  );
}
