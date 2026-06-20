"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { money, fmtDate } from "@/lib/format";

type Content = {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  image?: string;
  images?: string[];
  starRating?: number;
  rating?: number;
  reviewCount?: number;
  facilities?: string[];
  description?: string;
  latitude?: number;
  longitude?: number;
};

function stripHtml(s?: string): string {
  if (!s) return "";
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function Stars({ n }: { n: number }) {
  const v = Math.round(n);
  return (
    <span className="text-sunset">
      {"★".repeat(v)}
      <span className="text-ink/20">{"★".repeat(Math.max(0, 5 - v))}</span>
    </span>
  );
}

function DetailInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const hotelId = sp.get("hotelId") || "";

  const offer = {
    offerId: sp.get("offerId") || "",
    name: sp.get("name") || "Khách sạn",
    room: sp.get("room") || "",
    checkIn: sp.get("checkIn") || "",
    checkOut: sp.get("checkOut") || "",
    guests: Number(sp.get("guests") || 2),
    price: Number(sp.get("price") || 0),
    currency: sp.get("currency") || "VND",
  };

  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!hotelId) {
      setErr("Thiếu mã khách sạn.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/hotels/detail?hotelId=${encodeURIComponent(hotelId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không tải được chi tiết");
        setContent(data.content || {});
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [hotelId]);

  async function book() {
    setErr(null);
    if (offer.offerId.startsWith("static-")) {
      setBusy(true);
      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offer: {
              offerId: offer.offerId, hotelId, name: offer.name,
              roomDescription: offer.room, checkIn: offer.checkIn, checkOut: offer.checkOut,
            },
            guests: offer.guests,
          }),
        });
        if (res.status === 401) return router.push(`/login?next=/hotels`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Đặt phòng thất bại");
        setDone(true);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const qs = new URLSearchParams({
      offerId: offer.offerId, hotelId, name: offer.name, room: offer.room,
      checkIn: offer.checkIn, checkOut: offer.checkOut, guests: String(offer.guests),
      price: String(offer.price), currency: offer.currency,
    });
    if (content?.image) qs.set("image", content.image);
    if (content?.address) qs.set("address", content.address);
    router.push(`/checkout?${qs.toString()}`);
  }

  if (loading) return <div className="container-px py-16 text-ink/60">Đang tải chi tiết…</div>;
  if (err && !content) return <div className="container-px py-16 text-coral">{err}</div>;

  const c = content || {};
  const images = c.images && c.images.length > 0 ? c.images : c.image ? [c.image] : [];
  const main = images[active] || images[0];
  const nights = Math.max(1, Math.round((+new Date(offer.checkOut) - +new Date(offer.checkIn)) / 86400000));
  const mapSrc =
    c.latitude && c.longitude
      ? `https://www.google.com/maps?q=${c.latitude},${c.longitude}&z=15&output=embed`
      : c.address
      ? `https://www.google.com/maps?q=${encodeURIComponent(c.address + " " + (c.city || ""))}&z=14&output=embed`
      : null;

  return (
    <div className="container-px py-8">
      <button className="text-sm text-ink/55 hover:text-teal" onClick={() => router.back()}>← Quay lại danh sách</button>

      {/* Tiêu đề */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl text-teal">{c.name}</h1>
        {c.starRating ? <Stars n={c.starRating} /> : null}
      </div>
      {c.address && <p className="mt-1 text-ink/60">📍 {c.address}{c.city ? `, ${c.city}` : ""}</p>}
      {typeof c.rating === "number" && c.rating > 0 && (
        <p className="mt-1 text-sm text-jade">⭐ {c.rating.toFixed(1)}/10{c.reviewCount ? ` · ${c.reviewCount} đánh giá` : ""}</p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* Cột trái: gallery + mô tả + tiện ích + bản đồ */}
        <div>
          {/* Gallery */}
          {main ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={main} alt={c.name} className="h-80 w-full rounded-2xl object-cover" />
              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {images.slice(0, 8).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src + i}
                      src={src}
                      alt=""
                      onClick={() => setActive(i)}
                      className={`h-16 w-24 shrink-0 cursor-pointer rounded-lg object-cover ring-2 transition ${
                        i === active ? "ring-jade" : "ring-transparent hover:ring-teal/30"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-80 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-jade font-display text-2xl text-mist/80">
              An Lành Bay
            </div>
          )}

          {/* Mô tả */}
          {c.description && (
            <section className="mt-8">
              <h2 className="font-display text-xl text-teal">Giới thiệu</h2>
              <p className="mt-2 leading-relaxed text-ink/75">{stripHtml(c.description)}</p>
            </section>
          )}

          {/* Tiện ích */}
          {c.facilities && c.facilities.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-xl text-teal">Tiện ích & phúc lợi</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {c.facilities.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-ink/75">
                    <span className="text-jade">✓</span> {f}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bản đồ */}
          {mapSrc && (
            <section className="mt-8">
              <h2 className="font-display text-xl text-teal">Vị trí</h2>
              <iframe
                title="map"
                src={mapSrc}
                className="mt-3 h-72 w-full rounded-2xl border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </section>
          )}
        </div>

        {/* Cột phải: thẻ đặt phòng */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="card p-5">
            {offer.room && <p className="text-sm text-ink/70">{offer.room}</p>}
            <div className="mt-1 text-xs text-ink/50">
              {fmtDate(offer.checkIn)} → {fmtDate(offer.checkOut)} · {nights} đêm · {offer.guests} khách
            </div>
            <div className="mt-3 font-mono text-2xl text-teal">{money(offer.price, offer.currency)}</div>
            <div className="text-xs text-ink/50">tổng kỳ lưu trú</div>

            {done ? (
              <p className="mt-4 rounded-xl bg-jade/15 px-4 py-3 text-sm text-jade">
                Đã tạo đơn. Xem tại <a className="font-semibold underline" href="/bookings">Đơn của tôi</a>.
              </p>
            ) : (
              <button className="btn-gold mt-4 w-full" onClick={book} disabled={busy || !offer.offerId}>
                {busy ? "Đang đặt…" : "Đặt phòng"}
              </button>
            )}
            {err && <p className="mt-3 text-sm text-coral">{err}</p>}
            <p className="mt-3 text-xs text-ink/50">
              🔒 Thanh toán nhập trên cổng an toàn của LiteAPI. Hệ thống không lưu thông tin thẻ.
            </p>
          </div>

          {/* Trưng bày phụ: ảnh + điểm nổi bật — lấp khoảng trống cột phải */}
          {(images.length > 1 || (c.facilities && c.facilities.length > 0)) && (
            <div className="card mt-4 overflow-hidden p-0">
              {images.length > 1 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={images[1]}
                  alt={c.name}
                  className="h-40 w-full object-cover"
                />
              )}
              <div className="p-4">
                <p className="font-display text-teal">Điểm nổi bật</p>
                {c.facilities && c.facilities.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-sm text-ink/75">
                    {c.facilities.slice(0, 5).map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <span className="text-jade">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-ink/65">
                    Vị trí thuận tiện, dịch vụ chu đáo — đặt ngay để giữ mức giá tốt.
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function HotelDetailPage() {
  return (
    <Suspense fallback={<div className="container-px py-16 text-ink/60">Đang tải…</div>}>
      <DetailInner />
    </Suspense>
  );
}
