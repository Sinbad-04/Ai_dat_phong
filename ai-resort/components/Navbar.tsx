"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { id: string; name: string; email: string; role: "user" | "admin" } | null;

export default function Navbar() {
  const [me, setMe] = useState<Me>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user))
      .catch(() => setMe(null));
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    router.push("/");
    router.refresh();
  }

  const link = (href: string, label: string) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      className={`px-3 py-1.5 rounded-full text-sm transition ${
        pathname === href ? "bg-teal text-mist" : "text-ink/70 hover:text-teal hover:bg-teal/5"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-teal/10 bg-mist/80 backdrop-blur">
      <nav className="container-px flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal text-mist text-lg shadow-card">⛵</span>
          <span className="font-display text-lg leading-none">
            An Lành<span className="text-jade">Bay</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {link("/rooms", "Phòng & gói")}
          {link("/hotels", "Khách sạn")}
          {link("/assistant", "Trợ lý AI")}
          {me && link("/bookings", "Đặt phòng của tôi")}
          {me?.role === "admin" && link("/admin", "Quản trị")}
        </div>

        <div className="hidden md:flex items-center gap-2">
          {me ? (
            <>
              <span className="text-sm text-ink/60">Chào, {me.name.split(" ").slice(-1)[0]}</span>
              <button onClick={logout} className="btn-ghost">Đăng xuất</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Đăng nhập</Link>
              <Link href="/register" className="btn-primary">Tạo tài khoản</Link>
            </>
          )}
        </div>

        <button
          className="md:hidden btn-ghost px-3"
          onClick={() => setOpen((o) => !o)}
          aria-label="Mở menu"
        >
          ☰
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-teal/10 bg-mist/95 px-5 py-3 flex flex-col gap-1">
          {link("/rooms", "Phòng & gói")}
          {link("/hotels", "Khách sạn")}
          {link("/assistant", "Trợ lý AI")}
          {me && link("/bookings", "Đặt phòng của tôi")}
          {me?.role === "admin" && link("/admin", "Quản trị")}
          <div className="pt-2 mt-1 border-t border-teal/10 flex gap-2">
            {me ? (
              <button onClick={logout} className="btn-ghost flex-1">Đăng xuất</button>
            ) : (
              <>
                <Link href="/login" className="btn-ghost flex-1">Đăng nhập</Link>
                <Link href="/register" className="btn-primary flex-1">Tạo tài khoản</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
