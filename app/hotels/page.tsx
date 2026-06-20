"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { areasForDestination, DESTINATIONS, findDestination } from "@/lib/data/destinations";
import { videoFor } from "@/lib/data/hotel-videos";
import HotelMedia from "@/components/HotelMedia";
import { money, fmtDate } from "@/lib/format";

type LiveHotel = {
  hotelId: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  image?: string;
  images?: string[];
  starRating?: number;
  rating?: number;
  reviewCount?: number;
  facilities?: string[];
  offerId: string;
  offerToken?: string;
  rateName: string;
  boardName?: string;
  refundable?: boolean;
  price: number;
  currency: string;
  checkin: string;
  checkout: string;
};

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function Stars({ n }: { n: number }) {
  const v = Math.round(n);
  return <span className="text-sunset">{"★".repeat(v)}<span className="text-ink/20">{"★".repeat(Math.max(0, 5 - v))}</span></span>;
}

export default function HotelsPage() {
  const router = useRouter();
  const [dest, setDest] = useState("Nha Trang|VN");
  const [area, setArea] = useState("");
  const [checkin, setCheckin] = useState(todayPlus(14));
  const [checkout, setCheckout] = useState(todayPlus(16));
  const [adults, setAdults] = useState(2);

  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"liteapi" | "fallback" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [hotels, setHotels] = useState<LiveHotel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [maxNightly, setMaxNightly] = useState("");
  const [minStars, setMinStars] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [facility, setFacility] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("dest");
    if (requested && DESTINATIONS.some((item) => `${item.cityName}|${item.countryCode}` === requested)) {
      setDest(requested);
      const destination = findDestination(requested);
      const requestedArea = params.get("area") || "";
      if (destination && areasForDestination(destination).some((item) => item.value === requestedArea)) {
        setArea(requestedArea);
      }
    }
  }, []);

  const selectedDestination = useMemo(() => findDestination(dest), [dest]);
  const destinationAreas = useMemo(
    () => selectedDestination ? areasForDestination(selectedDestination) : [],
    [selectedDestination]
  );

  const visibleHotels = useMemo(() => {
    const nights = Math.max(1, Math.round((+new Date(checkout) - +new Date(checkin)) / 86_400_000));
    const max = Number(maxNightly) || Infinity;
    const keyword = facility.trim().toLocaleLowerCase("vi");
    return hotels.filter((hotel) => {
      const nightly = hotel.price / nights;
      const facilityMatch = !keyword || (hotel.facilities || []).some((item) => item.toLocaleLowerCase("vi").includes(keyword));
      return nightly <= max && (hotel.starRating || 0) >= minStars && (hotel.rating || 0) >= minRating && facilityMatch;
    });
  }, [hotels, checkin, checkout, maxNightly, minStars, minRating, facility]);

  async function search() {
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const qs = new URLSearchParams({ dest, checkin, checkout, adults: String(adults) });
      if (area) qs.set("area", area);
      const res = await fetch(`/api/hotels?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tìm kiếm thất bại");
      setSource(data.source);
      setNote(data.note || null);
      setHotels(data.hotels || []);
    } catch (e: any) {
      setError(e.message);
      setHotels([]);
    } finally {
      setLoading(false);
    }
  }

  function openDetail(h: LiveHotel) {
    const qs = new URLSearchParams({
      hotelId: h.hotelId, offerId: h.offerId, name: h.name, room: h.rateName,
      checkIn: h.checkin, checkOut: h.checkout, guests: String(adults),
      price: String(h.price), currency: h.currency,
    });
    if (h.offerToken) qs.set("offerToken", h.offerToken);
    router.push(`/hotels/detail?${qs.toString()}`);
  }

  async function choose(h: LiveHotel) {
    setError(null);
    setDone(null);
    if (h.offerId.startsWith("static-")) {
      setBusy(h.offerId);
      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offer: {
              offerId: h.offerId, hotelId: h.hotelId, name: h.name,
              roomDescription: h.rateName, checkIn: h.checkin, checkOut: h.checkout,
            },
            guests: adults,
          }),
        });
        if (res.status === 401) return router.push("/login?next=/hotels");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Đặt phòng thất bại");
        setDone(h.name);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(null);
      }
      return;
    }
    const qs = new URLSearchParams({
      offerId: h.offerId, hotelId: h.hotelId, name: h.name, room: h.rateName,
      checkIn: h.checkin, checkOut: h.checkout, guests: String(adults),
      price: String(h.price), currency: h.currency,
    });
    if (h.offerToken) qs.set("offerToken", h.offerToken);
    if (h.image) qs.set("image", h.image);
    if (h.address) qs.set("address", h.address);
    router.push(`/checkout?${qs.toString()}`);
  }

  return (
    <div className="container-px py-10">
      <span className="eyebrow">Tìm khách sạn · dữ liệu thật (LiteAPI)</span>
      <h1 className="mt-2 font-display text-3xl text-teal">Tìm phòng trống & giá realtime</h1>
      <p className="mt-2 max-w-2xl text-ink/70">
        Phòng trống, giá, ảnh và tiện ích lấy trực tiếp từ LiteAPI. Thanh toán nhập trên cổng an toàn
        của LiteAPI — hệ thống của chúng tôi không lưu thông tin thẻ.
      </p>

      <div className="card mt-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label">Điểm đến</label>
          <select className="field mt-1" value={dest} onChange={(e) => { setDest(e.target.value); setArea(""); }}>
            <optgroup label="Việt Nam">
              {DESTINATIONS.filter((d) => !d.intl).map((d) => (
                <option key={`${d.cityName}|${d.countryCode}`} value={`${d.cityName}|${d.countryCode}`}>{d.label}</option>
              ))}
            </optgroup>
            <optgroup label="Quốc tế (nhiều dữ liệu sandbox)">
              {DESTINATIONS.filter((d) => d.intl).map((d) => (
                <option key={`${d.cityName}|${d.countryCode}`} value={`${d.cityName}|${d.countryCode}`}>{d.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="label">Khu vực</label>
          <select
            className="field mt-1"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            disabled={destinationAreas.length === 0}
          >
            <option value="">Tất cả khu vực</option>
            {destinationAreas.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Nhận phòng</label>
          <input className="field mt-1" type="date" min={todayPlus(0)} value={checkin} onChange={(e) => setCheckin(e.target.value)} />
        </div>
        <div>
          <label className="label">Trả phòng</label>
          <input className="field mt-1" type="date" value={checkout} min={checkin} onChange={(e) => setCheckout(e.target.value)} />
        </div>
        <div>
          <label className="label">Số khách</label>
          <input className="field mt-1" type="number" min={1} max={9} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
        </div>
        <div className="sm:col-span-2 lg:col-span-5">
          <button className="btn-gold" onClick={search} disabled={loading}>
            {loading ? "Đang tìm…" : "Tìm khách sạn"}
          </button>
        </div>
      </div>

      {hotels.length > 0 && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-teal/10 bg-white/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Giá tối đa/đêm (VND)</label>
            <input className="field mt-1" type="number" min={0} step={100000} value={maxNightly} onChange={(event) => setMaxNightly(event.target.value)} placeholder="Ví dụ 1000000" />
          </div>
          <div>
            <label className="label">Hạng sao tối thiểu</label>
            <select className="field mt-1" value={minStars} onChange={(event) => setMinStars(Number(event.target.value))}>
              {[0, 3, 4, 5].map((value) => <option key={value} value={value}>{value ? `${value} sao` : "Tất cả"}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Điểm đánh giá tối thiểu</label>
            <select className="field mt-1" value={minRating} onChange={(event) => setMinRating(Number(event.target.value))}>
              {[0, 7, 8, 9].map((value) => <option key={value} value={value}>{value ? `${value}/10` : "Tất cả"}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tiện ích</label>
            <input className="field mt-1" value={facility} onChange={(event) => setFacility(event.target.value)} placeholder="Hồ bơi, WiFi…" />
          </div>
        </div>
      )}

      {source && (
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${source === "liteapi" ? "bg-jade/15 text-jade" : "bg-sunset/20 text-teal"}`}>
            {source === "liteapi" ? "● Dữ liệu thật (LiteAPI)" : "● Dữ liệu mẫu (fallback)"}
          </span>
          {note && <span className="text-ink/60">{note}</span>}
        </div>
      )}
      {error && <p className="mt-4 rounded-xl bg-coral/15 px-4 py-3 text-sm text-coral">{error}</p>}
      {done && (
        <p className="mt-4 rounded-xl bg-jade/15 px-4 py-3 text-sm text-jade">
          Đã tạo đơn cho “{done}”. Xem & hoàn tất cọc tại <a className="font-semibold underline" href="/bookings">Đơn của tôi</a>.
        </p>
      )}

      <div className="mt-6 grid gap-5">
        {visibleHotels.map((h) => (
          <div key={h.offerId} className="card overflow-hidden p-0 sm:flex">
            {/* Ảnh — hover để xem nhanh (slideshow ảnh hoặc video nếu có) */}
            <HotelMedia
              name={h.name}
              image={h.image}
              images={h.images}
              videoUrl={videoFor(h.hotelId, h.city)}
              onClick={() => openDetail(h)}
              className="h-44 w-full sm:h-auto sm:min-h-[12rem] sm:w-64"
            />

            {/* Nội dung */}
            <div className="flex flex-1 flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="cursor-pointer font-display text-lg text-teal hover:underline" onClick={() => openDetail(h)}>{h.name}</h3>
                  {h.starRating ? <Stars n={h.starRating} /> : null}
                </div>
                {h.address && (
                  <p className="mt-1 text-sm text-ink/60">
                    📍 {h.address}{h.city ? `, ${h.city}` : ""}
                  </p>
                )}
                <p className="mt-1 text-sm text-ink/70">{h.rateName}</p>
                <p className="mt-1 text-xs text-ink/50">
                  {fmtDate(h.checkin)} → {fmtDate(h.checkout)}
                  {h.boardName ? ` · ${h.boardName}` : ""}
                  {h.refundable ? " · Hoàn huỷ được" : ""}
                </p>
                {h.facilities && h.facilities.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {h.facilities.slice(0, 6).map((f) => (
                      <span key={f} className="rounded-full bg-teal/8 px-2.5 py-0.5 text-[11px] text-teal">{f}</span>
                    ))}
                  </div>
                )}
                {typeof h.rating === "number" && h.rating > 0 && (
                  <p className="mt-2 text-xs text-jade">
                    ⭐ {h.rating.toFixed(1)}/10{h.reviewCount ? ` · ${h.reviewCount} đánh giá` : ""}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end">
                <div className="text-right">
                  <div className="font-mono text-lg text-teal">{money(h.price, h.currency)}</div>
                  <div className="text-xs text-ink/50">tổng kỳ lưu trú</div>
                  <div className="text-xs text-jade">
                    {money(Math.round(h.price / Math.max(1, Math.round((+new Date(h.checkout) - +new Date(h.checkin)) / 86_400_000))), h.currency)}/đêm
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost whitespace-nowrap" onClick={() => openDetail(h)}>Chi tiết</button>
                  <button className="btn-primary whitespace-nowrap" onClick={() => choose(h)} disabled={busy === h.offerId}>
                    {busy === h.offerId ? "Đang đặt…" : "Đặt phòng"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {!loading && source && visibleHotels.length === 0 && (
          <p className="text-ink/60">Không có kết quả phù hợp. Thử đổi điểm đến hoặc ngày.</p>
        )}
      </div>
    </div>
  );
}
