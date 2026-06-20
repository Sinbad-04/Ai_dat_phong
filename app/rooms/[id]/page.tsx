import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROOMS } from "@/lib/data/knowledge";
import { vnd } from "@/lib/format";

export function generateStaticParams() {
  return ROOMS.map((room) => ({ id: room.id }));
}

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = ROOMS.find((item) => item.id === id);
  if (!room) notFound();

  return (
    <div className="container-px py-10">
      <Link href="/rooms" className="text-sm text-teal hover:underline">← Quay lại danh sách phòng</Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
        <div className="relative min-h-[320px] overflow-hidden rounded-3xl bg-gradient-to-br from-teal to-jade shadow-card sm:min-h-[460px]">
          {room.photo ? (
            <Image
              src={room.photo}
              alt={`Không gian ${room.name}`}
              fill
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-7xl" aria-hidden>{room.image}</span>
          )}
          <span className="absolute left-5 top-5 rounded-full bg-mist/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal">
            {room.type}
          </span>
        </div>

        <section className="card flex flex-col p-6 sm:p-8">
          <span className="eyebrow">Thông tin phòng</span>
          <h1 className="mt-2 font-display text-3xl text-teal sm:text-4xl">{room.name}</h1>
          <p className="mt-3 leading-relaxed text-ink/65">{room.blurb}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <Info label="Sức chứa" value={`Tối đa ${room.capacity} khách`} />
            <Info label="Diện tích" value={`${room.size}m²`} />
            <Info label="Giường" value={room.beds} />
            <Info label="Hướng nhìn" value={room.view} />
          </div>

          <div className="mt-6">
            <h2 className="font-display text-xl">Tiện nghi nổi bật</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {room.amenities.map((amenity) => (
                <span key={amenity} className="rounded-full bg-teal/7 px-3 py-1 text-xs text-teal">✓ {amenity}</span>
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
            <div>
              <div className="text-xs text-ink/45">Giá tham chiếu mỗi đêm</div>
              <div className="font-mono text-2xl text-teal">{vnd(room.basePrice)}</div>
            </div>
            <div className="flex gap-2">
              <Link href={`/assistant?q=${encodeURIComponent(`Tư vấn thêm về phòng ${room.name}`)}`} className="btn-ghost">
                Hỏi trợ lý
              </Link>
              <Link href={`/bookings?room=${room.id}`} className="btn-gold">Đặt phòng</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-mist p-3">
      <div className="text-[11px] uppercase tracking-wide text-ink/40">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  );
}
