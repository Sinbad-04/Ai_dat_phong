"use client";

import Link from "next/link";
import Image from "next/image";
import { vnd } from "@/lib/format";

export type RoomCardData = {
  id: string;
  name: string;
  type: string;
  capacity: number;
  beds: string;
  size: number;
  view: string;
  basePrice: number;
  amenities: string[];
  image: string;
  photo?: string;
  blurb: string;
};

export default function RoomCard({ room, compact = false }: { room: RoomCardData; compact?: boolean }) {
  const bookingHref = `/bookings?room=${room.id}`;

  return (
    <article className="card group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link
        href={bookingHref}
        aria-label={`Xem và đặt ${room.name}`}
        className="absolute inset-0 z-10 rounded-[inherit] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
      />
      <div className="relative grid h-36 place-items-center overflow-hidden bg-gradient-to-br from-teal to-jade text-4xl">
        {room.photo ? (
          <Image
            src={room.photo}
            alt={`Không gian ${room.name}`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span aria-hidden>{room.image}</span>
        )}
        {room.photo && <span className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/5" />}
        <span className="absolute top-3 left-3 text-[11px] font-medium uppercase tracking-wide bg-mist/90 text-teal px-2.5 py-1 rounded-full">
          {room.type}
        </span>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-display text-lg leading-tight transition group-hover:text-teal">{room.name}</h3>
          <p className="text-sm text-ink/60 mt-1">{room.blurb}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-ink/70">
          <span>👥 Tối đa {room.capacity} khách</span>
          <span>📐 {room.size}m²</span>
          <span>🛏️ {room.beds}</span>
          <span>🌅 {room.view}</span>
        </div>
        {!compact && (
          <div className="flex flex-wrap gap-1.5">
            {room.amenities.slice(0, 4).map((a) => (
              <span key={a} className="text-[11px] bg-teal/5 text-teal-600 px-2 py-0.5 rounded-full">
                {a}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <div className="text-[11px] text-ink/50">Giá tham chiếu / đêm</div>
            <div className="font-mono text-lg text-teal">{vnd(room.basePrice)}</div>
          </div>
          <Link href={bookingHref} className="btn-gold relative z-20">
            Đặt phòng
          </Link>
        </div>
      </div>
    </article>
  );
}
