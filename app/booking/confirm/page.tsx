"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

function ConfirmInner() {
  const sp = useSearchParams();
  const tid = sp.get("tid") || "";
  const ran = useRef(false);

  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!tid) {
        setError("Thiếu mã giao dịch.");
        setState("error");
        return;
      }
      try {
        const res = await fetch("/api/hotels/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: tid }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Xác nhận đặt phòng thất bại");
        setCode(data.confirmationCode || null);
        setState("done");
      } catch (e: any) {
        setError(e.message);
        setState("error");
      }
    })();
  }, [tid]);

  return (
    <div className="container-px py-16 max-w-xl text-center">
      {state === "working" && (
        <>
          <h1 className="font-display text-2xl text-teal">Đang xác nhận đặt phòng…</h1>
          <p className="mt-2 text-ink/60">Thanh toán đã nhận, đang hoàn tất đơn với khách sạn.</p>
        </>
      )}
      {state === "done" && (
        <>
          <div className="text-4xl">🎉</div>
          <h1 className="mt-3 font-display text-2xl text-teal">Đặt phòng thành công!</h1>
          {code && <p className="mt-2 font-mono text-sm text-ink/70">Mã xác nhận: {code}</p>}
          <p className="mt-3 text-ink/70">
            Đơn của bạn đã được xác nhận. Xem chi tiết tại{" "}
            <a className="font-semibold text-jade underline" href="/bookings">Đơn của tôi</a>.
          </p>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="font-display text-2xl text-coral">Chưa hoàn tất được đơn</h1>
          <p className="mt-2 text-ink/70">{error}</p>
          <p className="mt-3 text-sm text-ink/55">
            Nếu đã bị trừ tiền, khoản giữ sẽ tự hoàn trong 1–2 ngày nếu đơn không hoàn tất. Bạn có thể
            kiểm tra <a className="underline" href="/bookings">Đơn của tôi</a> hoặc thử lại.
          </p>
        </>
      )}
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="container-px py-16 text-center text-ink/60">Đang tải…</div>}>
      <ConfirmInner />
    </Suspense>
  );
}
