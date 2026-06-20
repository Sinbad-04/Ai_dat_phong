"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { vnd, money, fmtDate } from "@/lib/format";

type Room = {
  id: string; name: string; type: string; capacity: number; beds: string;
  size: number; view: string; basePrice: number; amenities: string[]; image: string; blurb: string;
};
type Pkg = { id: string; name: string; forWho: string; includes: string[]; fromPrice: number };
type Booking = {
  id: string; room_name: string; check_in: string; check_out: string; guests: number;
  nights: number; total_price: number; deposit: number; status: string; package_id: string | null;
  currency?: string; source?: string;
};

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function BookingsInner() {
  const params = useSearchParams();
  const presetRoom = params.get("room") || "";

  const [rooms, setRooms] = useState<Room[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [roomId, setRoomId] = useState(presetRoom);
  const [checkIn, setCheckIn] = useState(todayPlus(7));
  const [checkOut, setCheckOut] = useState(todayPlus(9));
  const [guests, setGuests] = useState(2);
  const [packageId, setPackageId] = useState("");
  const [notes, setNotes] = useState("");

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  useEffect(() => {
    fetch("/api/rooms").then((r) => r.json()).then((d) => {
      setRooms(d.rooms);
      setPackages(d.packages);
      if (!roomId && d.rooms[0]) setRoomId(d.rooms[0].id);
    });
    refreshBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshBookings() {
    fetch("/api/bookings").then((r) => r.json()).then((d) => setBookings(d.bookings || []));
  }

  async function cancelBooking(id: string) {
    if (!window.confirm("Bạn chắc chắn muốn hủy đơn này?")) return;
    setErr("");
    const response = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    if (!response.ok) return setErr(data.error || "Không hủy được đơn");
    refreshBookings();
  }

  const room = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);
  const nights = useMemo(() => {
    const n = Math.round((+new Date(checkOut) - +new Date(checkIn)) / 86400000);
    return Number.isFinite(n) ? n : 0;
  }, [checkIn, checkOut]);
  const pkg = packages.find((p) => p.id === packageId);
  const estTotal = room ? room.basePrice * Math.max(nights, 0) + (pkg ? Math.round(pkg.fromPrice * 0.15) : 0) : 0;
  const estDeposit = Math.round(estTotal * 0.3);

  async function submit() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId, checkIn, checkOut, guests,
          packageId: packageId || null, notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Đặt phòng thất bại");
      setConfirmed(data.booking);
      refreshBookings();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-px py-10">
      <span className="eyebrow">Hoàn tất đặt phòng</span>
      <h1 className="font-display text-4xl mt-2 mb-8">Đặt phòng của bạn</h1>

      <div className="grid lg:grid-cols-[1.1fr,.9fr] gap-8 items-start">
        {/* FORM */}
        <div className="card p-6">
          {confirmed ? (
            <PaymentGuidance booking={confirmed} onNew={() => setConfirmed(null)} />
          ) : (
            <>
              <h2 className="font-display text-xl mb-4">Thông tin đặt phòng</h2>
              {err && <div className="mb-4 text-sm text-coral bg-coral/10 rounded-lg px-3 py-2">{err}</div>}

              <div className="space-y-4">
                <div>
                  <label className="label">Chọn phòng</label>
                  <select className="field mt-1" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {vnd(r.basePrice)}/đêm (tối đa {r.capacity} khách)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nhận phòng</label>
                    <input className="field mt-1" type="date" value={checkIn}
                      min={todayPlus(0)} onChange={(e) => setCheckIn(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Trả phòng</label>
                    <input className="field mt-1" type="date" value={checkOut}
                      min={checkIn} onChange={(e) => setCheckOut(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Số khách</label>
                    <input className="field mt-1" type="number" min={1} max={room?.capacity || 10}
                      value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label">Gói trải nghiệm (tuỳ chọn)</label>
                    <select className="field mt-1" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                      <option value="">Không dùng gói</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Ghi chú (tuỳ chọn)</label>
                  <textarea className="field mt-1" rows={2} value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Vd: cần nôi em bé, phòng tầng cao…" />
                </div>

                <button onClick={submit} disabled={loading || nights < 1} className="btn-primary w-full disabled:opacity-50">
                  {loading ? "Đang xử lý…" : `Đặt phòng · cọc ${vnd(estDeposit)}`}
                </button>
                <p className="text-xs text-ink/45 text-center">
                  Đặt cọc 30% để giữ chỗ. Bạn tự nhập thanh toán trên cổng an toàn — resort không lưu thông tin thẻ.
                </p>
              </div>
            </>
          )}
        </div>

        {/* SUMMARY + LIST */}
        <div className="space-y-6">
          {!confirmed && room && (
            <div className="card p-6 sticky top-20">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-teal to-jade text-2xl">{room.image}</span>
                <div>
                  <div className="font-display text-lg">{room.name}</div>
                  <div className="text-xs text-ink/55">{room.view} · {room.size}m²</div>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm border-t border-teal/10 pt-4">
                <Row k={`${vnd(room.basePrice)} × ${Math.max(nights, 0)} đêm`} v={vnd(room.basePrice * Math.max(nights, 0))} />
                {pkg && <Row k={`Gói ${pkg.name}`} v={vnd(Math.round(pkg.fromPrice * 0.15))} />}
                <Row k="Tạm tính" v={vnd(estTotal)} bold />
                <Row k="Đặt cọc (30%)" v={vnd(estDeposit)} accent />
              </div>
            </div>
          )}

          <div className="card p-6">
            <h2 className="font-display text-xl mb-4">Lịch sử đặt phòng</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-ink/55">
                Bạn chưa có đặt phòng nào. Chưa chắc chọn gì?{" "}
                <Link href="/assistant" className="text-teal font-medium">Hỏi trợ lý AI</Link>.
              </p>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div key={b.id} className="rounded-xl border border-teal/12 p-3.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{b.room_name}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="text-xs text-ink/55 mt-1">
                      {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {b.nights} đêm · {b.guests} khách
                    </div>
                    <div className="font-mono text-xs text-teal mt-1">
                      Tổng {money(b.total_price, b.currency || "VND")} · cọc {money(b.deposit, b.currency || "VND")}
                    </div>
                    {["pending", "payment_pending"].includes(b.status) && (
                      <button
                        onClick={() => cancelBooking(b.id)}
                        className="mt-2 text-xs text-coral underline"
                      >
                        Hủy đơn
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentGuidance({ booking, onNew }: { booking: Booking; onNew: () => void }) {
  const bankName = process.env.NEXT_PUBLIC_BANK_NAME;
  const bankAccount = process.env.NEXT_PUBLIC_BANK_ACCOUNT;
  const bankHolder = process.env.NEXT_PUBLIC_BANK_HOLDER;
  const configured = !!(bankName && bankAccount && bankHolder);
  return (
    <div>
      <div className="flex items-center gap-2 text-jade mb-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-jade/15">✓</span>
        <span className="font-medium">Đã tạo đặt phòng — chờ thanh toán cọc</span>
      </div>
      <h2 className="font-display text-2xl mt-1">{booking.room_name}</h2>
      <div className="text-sm text-ink/60 mt-1">
        {fmtDate(booking.check_in)} → {fmtDate(booking.check_out)} · {booking.nights} đêm · {booking.guests} khách
      </div>

      <div className="mt-5 rounded-xl bg-sunset/10 border border-sunset/30 p-4">
        <div className="text-sm font-medium text-midnight">Hướng dẫn thanh toán cọc {vnd(booking.deposit)}</div>
        {configured ? (
          <ol className="mt-2 text-sm text-ink/70 space-y-1.5 list-decimal list-inside">
            <li>Chuyển khoản tới: <span className="font-mono">{bankHolder} · {bankAccount} · {bankName}</span></li>
            <li>Nội dung: <span className="font-mono">COC {booking.id}</span></li>
            <li>Quản trị viên sẽ đối soát và xác nhận đơn sau khi nhận cọc.</li>
          </ol>
        ) : (
          <p className="mt-2 text-sm text-coral">
            Resort chưa cấu hình tài khoản nhận cọc. Vui lòng liên hệ lễ tân trước khi chuyển tiền.
          </p>
        )}
        <p className="text-xs text-ink/50 mt-3">
          🔒 Resort <b>không lưu trữ</b> thông tin thẻ của bạn. Mọi thao tác nhập thẻ diễn ra trên cổng ngân hàng.
        </p>
      </div>

      <button onClick={onNew} className="btn-ghost w-full mt-4">Đặt phòng khác</button>
    </div>
  );
}

function Row({ k, v, bold, accent }: { k: string; v: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${bold ? "font-medium" : "text-ink/60"}`}>{k}</span>
      <span className={`font-mono ${accent ? "text-sunset font-medium" : bold ? "text-ink" : "text-ink/70"}`}>{v}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    payment_pending: "bg-teal/10 text-teal",
    pending: "bg-sunset/15 text-sunset",
    confirmed: "bg-jade/15 text-jade",
    cancelled: "bg-coral/15 text-coral",
  };
  const label: Record<string, string> = {
    payment_pending: "Chờ thanh toán", pending: "Chờ xác nhận", confirmed: "Đã xác nhận", cancelled: "Đã huỷ",
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${map[status] || ""}`}>{label[status] || status}</span>;
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="container-px py-16 text-center text-ink/50">Đang tải…</div>}>
      <BookingsInner />
    </Suspense>
  );
}
