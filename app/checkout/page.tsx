"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { money, fmtDate } from "@/lib/format";

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).LiteAPIPayment) return resolve();
    const s = document.createElement("script");
    s.src = "https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Không tải được Payment SDK của LiteAPI"));
    document.head.appendChild(s);
  });
}

function CheckoutInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const mounted = useRef(false);

  const offer = {
    offerId: sp.get("offerId") || "",
    hotelId: sp.get("hotelId") || "",
    name: sp.get("name") || "Khách sạn",
    room: sp.get("room") || "",
    checkIn: sp.get("checkIn") || "",
    checkOut: sp.get("checkOut") || "",
    guests: Number(sp.get("guests") || 2),
    price: Number(sp.get("price") || 0),
    currency: sp.get("currency") || "VND",
    image: sp.get("image") || "",
    address: sp.get("address") || "",
    offerToken: sp.get("offerToken") || "",
  };

  const [phase, setPhase] = useState<"review" | "paying" | "error">("review");
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAddress, setGuestAddress] = useState("");

  async function startPayment() {
    setError(null);
    if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim() || !guestAddress.trim()) {
      setError("Vui lòng nhập đầy đủ thông tin người đặt trước khi thanh toán.");
      return;
    }
    setPhase("paying");
    try {
      // 1) Prebook ở server -> lấy tham số cho Payment SDK (không có dữ liệu thẻ)
      const res = await fetch("/api/hotels/prebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offer.offerId,
          hotelId: offer.hotelId,
          name: offer.name,
          roomDescription: offer.room,
          checkIn: offer.checkIn,
          checkOut: offer.checkOut,
          guests: offer.guests,
          offerToken: offer.offerToken,
          guestName,
          guestEmail,
          guestPhone,
          guestAddress,
        }),
      });
      if (res.status === 401) return router.push(`/login?next=/checkout`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Khoá giá thất bại");

      // 2) Nạp Payment SDK & mở cổng thanh toán (khách nhập thẻ trên cổng của LiteAPI)
      await loadSdk();
      const returnUrl = `${window.location.origin}/booking/confirm?tid=${encodeURIComponent(data.transactionId)}`;
      const config = {
        publicKey: data.publicKey, // 'sandbox' | 'live'
        appearance: { theme: "flat" },
        options: { business: { name: "An Lành Bay" } },
        targetElement: "#liteapi-payment",
        secretKey: data.secretKey,
        returnUrl,
      };
      const sdk = new (window as any).LiteAPIPayment(config);
      sdk.handlePayment();
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  }

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (!offer.offerId) {
      setError("Thiếu thông tin ưu đãi. Vui lòng quay lại trang Khách sạn.");
      setPhase("error");
    }
    fetch("/api/auth/me").then((response) => response.json()).then((data) => {
      if (data.user) {
        setGuestName(data.user.name || "");
        setGuestEmail(data.user.email || "");
      }
    }).catch(() => undefined);
  }, [offer.offerId]);

  const nights = Math.max(
    1,
    Math.round((+new Date(offer.checkOut) - +new Date(offer.checkIn)) / 86400000)
  );

  return (
    <div className="container-px py-10 max-w-3xl">
      <span className="eyebrow">Thanh toán an toàn qua LiteAPI</span>
      <h1 className="mt-2 font-display text-3xl text-teal">Hoàn tất đặt phòng</h1>

      <div className="card mt-6 overflow-hidden p-0">
        {offer.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.image} alt={offer.name} className="h-48 w-full object-cover" />
        )}
        <div className="p-5">
          <h2 className="font-display text-xl text-teal">{offer.name}</h2>
          {offer.address && <p className="mt-1 text-sm text-ink/60">📍 {offer.address}</p>}
          {offer.room && <p className="mt-1 text-sm text-ink/70">{offer.room}</p>}
          <div className="mt-3 text-sm text-ink/70">
            {fmtDate(offer.checkIn)} → {fmtDate(offer.checkOut)} · {nights} đêm · {offer.guests} khách
          </div>
          <div className="mt-3 font-mono text-2xl text-teal">{money(offer.price, offer.currency)}</div>
          <p className="mt-1 text-xs text-ink/50">Thanh toán toàn phần qua cổng LiteAPI.</p>
        </div>
      </div>

      <div className="card mt-5 p-5">
        <h2 className="font-display text-xl text-teal">Thông tin người đặt</h2>
        <p className="mt-1 text-xs text-ink/50">Khách sạn sử dụng thông tin này để xác nhận và liên hệ về đơn.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Họ và tên</label>
            <input className="field mt-1" value={guestName} onChange={(event) => setGuestName(event.target.value)}
              autoComplete="name" maxLength={100} placeholder="Nguyễn Văn A" disabled={phase === "paying"} />
          </div>
          <div>
            <label className="label">Số điện thoại</label>
            <input className="field mt-1" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)}
              type="tel" autoComplete="tel" maxLength={20} placeholder="0901 234 567" disabled={phase === "paying"} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="field mt-1" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)}
              type="email" autoComplete="email" maxLength={254} placeholder="email@example.com" disabled={phase === "paying"} />
          </div>
          <div>
            <label className="label">Địa chỉ</label>
            <input className="field mt-1" value={guestAddress} onChange={(event) => setGuestAddress(event.target.value)}
              autoComplete="street-address" maxLength={250} placeholder="Quận/Huyện, Tỉnh/Thành phố" disabled={phase === "paying"} />
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-teal/5 px-4 py-3 text-sm text-ink/70">
        🔒 Thông tin thẻ được nhập trực tiếp trên cổng thanh toán của LiteAPI. Hệ thống An Lành Bay
        không nhận, không lưu dữ liệu thẻ của bạn. (Sandbox dùng thẻ thử 4242 4242 4242 4242, CVV bất
        kỳ 3 số, hạn trong tương lai.)
      </p>

      {error && <p className="mt-4 rounded-xl bg-coral/15 px-4 py-3 text-sm text-coral">{error}</p>}

      {phase === "review" && (
        <button className="btn-gold mt-5 disabled:opacity-50" onClick={startPayment}
          disabled={!guestName.trim() || !guestEmail.trim() || !guestPhone.trim() || !guestAddress.trim()}>
          Tiến hành thanh toán
        </button>
      )}
      {phase === "error" && (
        <button className="btn-ghost mt-5" onClick={() => router.push("/hotels")}>
          ← Quay lại trang Khách sạn
        </button>
      )}

      {/* Payment SDK của LiteAPI sẽ render cổng thanh toán vào đây */}
      <div id="liteapi-payment" className="mt-6" />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="container-px py-10 text-ink/60">Đang tải…</div>}>
      <CheckoutInner />
    </Suspense>
  );
}
