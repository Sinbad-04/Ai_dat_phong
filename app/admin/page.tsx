"use client";

import { useEffect, useState } from "react";
import { vnd, money, fmtDate } from "@/lib/format";

type AdminBooking = {
  id: string; user_email: string; room_name: string; check_in: string; check_out: string;
  guests: number; nights: number; total_price: number; deposit: number; status: string;
  currency?: string; source?: string;
  guest_name?: string | null; guest_email?: string | null; guest_phone?: string | null; guest_address?: string | null;
};
type AdminUser = { id: string; name: string; email: string; role: string; created_at: string };

export default function AdminPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tab, setTab] = useState<"bookings" | "users">("bookings");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    load();
  }, []);

  function load() {
    fetch("/api/admin/bookings").then((r) => r.json()).then((d) => setBookings(d.bookings || []));
    fetch("/api/admin/users").then((r) => r.json()).then((d) => setUsers(d.users || []));
  }

  async function setStatus(id: string, status: string) {
    setError("");
    const response = await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Không cập nhật được trạng thái");
      return;
    }
    load();
  }

  async function setRole(id: string, role: "user" | "admin") {
    setError("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "Không cập nhật được vai trò");
    load();
  }

  const revenueByCurrency = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce<Record<string, number>>((totals, booking) => {
      const currency = booking.currency || "VND";
      totals[currency] = (totals[currency] || 0) + booking.total_price;
      return totals;
    }, {});
  const revenue = Object.entries(revenueByCurrency)
    .map(([currency, total]) => money(total, currency))
    .join(" · ") || vnd(0);
  const pending = bookings.filter((b) => b.status === "pending").length;
  const currentItems = tab === "bookings" ? bookings : users;
  const pageCount = Math.max(1, Math.ceil(currentItems.length / pageSize));
  const pagedBookings = bookings.slice((page - 1) * pageSize, page * pageSize);
  const pagedUsers = users.slice((page - 1) * pageSize, page * pageSize);

  function selectTab(value: "bookings" | "users") {
    setTab(value);
    setPage(1);
  }

  return (
    <div className="container-px py-10">
      <span className="eyebrow">Bảng điều khiển</span>
      <h1 className="font-display text-4xl mt-2 mb-8">Quản trị resort</h1>

      <div className="grid sm:grid-cols-4 gap-4 mb-8">
        <Stat label="Tổng đơn" value={String(bookings.length)} />
        <Stat label="Chờ xác nhận" value={String(pending)} accent />
        <Stat label="Doanh thu (chưa huỷ)" value={revenue} />
        <Stat label="Khách hàng" value={String(users.length)} />
      </div>

      {error && <p className="mb-4 rounded-xl bg-coral/15 px-4 py-3 text-sm text-coral">{error}</p>}

      <div className="flex gap-2 mb-5">
        <button onClick={() => selectTab("bookings")}
          className={tab === "bookings" ? "btn-primary" : "btn-ghost"}>Đặt phòng</button>
        <button onClick={() => selectTab("users")}
          className={tab === "users" ? "btn-primary" : "btn-ghost"}>Người dùng</button>
      </div>

      {tab === "bookings" ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-teal/5 text-left text-xs uppercase tracking-wide text-teal-600">
                <tr>
                  <th className="px-4 py-3">Khách</th>
                  <th className="px-4 py-3">Phòng</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Tổng</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal/8">
                {bookings.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/50">Chưa có đơn đặt phòng nào.</td></tr>
                )}
                {pagedBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-teal/3">
                    <td className="px-4 py-3 text-ink/70">
                      <div className="font-medium text-ink">{b.guest_name || b.user_email}</div>
                      <div className="text-xs">{b.guest_phone || "Chưa có SĐT"}</div>
                      <div className="text-xs">{b.guest_email || b.user_email}</div>
                      {b.guest_address && <div className="max-w-52 truncate text-[11px] text-ink/45" title={b.guest_address}>{b.guest_address}</div>}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {b.room_name}
                      {b.source === "liteapi" && (
                        <span className="ml-2 rounded bg-jade/15 px-1.5 py-0.5 text-[10px] font-semibold text-jade align-middle">LIVE</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink/60">
                      {fmtDate(b.check_in)}→{fmtDate(b.check_out)}<br />{b.nights} đêm · {b.guests} khách
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{money(b.total_price, b.currency || "VND")}</td>
                    <td className="px-4 py-3"><Badge status={b.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {b.status === "pending" && (
                          <button onClick={() => setStatus(b.id, "confirmed")}
                            className="text-xs px-2.5 py-1 rounded-full bg-jade/15 text-jade hover:bg-jade/25">Xác nhận</button>
                        )}
                        {["pending", "payment_pending"].includes(b.status) && (
                          <button onClick={() => setStatus(b.id, "cancelled")}
                            className="text-xs px-2.5 py-1 rounded-full bg-coral/15 text-coral hover:bg-coral/25">Huỷ</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-teal/5 text-left text-xs uppercase tracking-wide text-teal-600">
                <tr>
                  <th className="px-4 py-3">Tên</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Tạo lúc</th>
                  <th className="px-4 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal/8">
                {pagedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-teal/3">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-ink/70">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-teal/15 text-teal" : "bg-ink/8 text-ink/60"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink/55">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setRole(u.id, u.role === "admin" ? "user" : "admin")}
                        className="text-xs rounded-full border border-teal/20 px-2.5 py-1 text-teal"
                      >
                        {u.role === "admin" ? "Hạ quyền" : "Đặt làm admin"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentItems.length > pageSize && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button className="btn-ghost" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>← Trước</button>
          <span>Trang {page}/{pageCount}</span>
          <button className="btn-ghost" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount}>Sau →</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-ink/55">{label}</div>
      <div className={`font-display text-2xl mt-1 ${accent ? "text-sunset" : "text-teal"}`}>{value}</div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    payment_pending: "bg-teal/10 text-teal", pending: "bg-sunset/15 text-sunset", confirmed: "bg-jade/15 text-jade", cancelled: "bg-coral/15 text-coral",
  };
  const label: Record<string, string> = {
    payment_pending: "Chờ thanh toán", pending: "Chờ xác nhận", confirmed: "Đã xác nhận", cancelled: "Đã huỷ",
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${map[status] || ""}`}>{label[status] || status}</span>;
}
