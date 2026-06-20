import { ROOMS, PACKAGES, SEASONAL } from "@/lib/data/knowledge";
import RoomCard from "@/components/RoomCard";
import Link from "next/link";
import { vnd } from "@/lib/format";

export const metadata = { title: "Phòng & gói — An Lành Bay" };

export default function RoomsPage() {
  return (
    <div className="container-px py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <span className="eyebrow">Lưu trú</span>
          <h1 className="font-display text-4xl mt-2">Phòng, villa & gói nghỉ dưỡng</h1>
          <p className="text-ink/65 mt-2 max-w-2xl">
            Chưa biết chọn gì? Để <Link href="/assistant" className="text-teal font-medium">trợ lý AI</Link> gợi ý theo nhu cầu của bạn.
          </p>
        </div>
        <Link href="/assistant" className="btn-primary self-start">Hỏi trợ lý AI →</Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {ROOMS.map((r) => (
          <RoomCard key={r.id} room={r} />
        ))}
      </div>

      <section className="mt-16">
        <span className="eyebrow">Trải nghiệm trọn gói</span>
        <h2 className="font-display text-3xl mt-2 mb-6">Gói nghỉ dưỡng</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PACKAGES.map((p) => (
            <div key={p.id} className="card p-5 flex flex-col">
              <h3 className="font-display text-lg">{p.name}</h3>
              <p className="text-xs text-jade mt-1">{p.forWho}</p>
              <ul className="mt-3 space-y-1 text-sm text-ink/65 flex-1">
                {p.includes.map((i) => (
                  <li key={i} className="flex gap-2"><span className="text-jade">•</span>{i}</li>
                ))}
              </ul>
              <div className="mt-4 font-mono text-teal">Từ {vnd(p.fromPrice)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <span className="eyebrow">Đặt đúng thời điểm</span>
        <h2 className="font-display text-3xl mt-2 mb-6">Ưu đãi theo mùa</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {SEASONAL.map((s) => (
            <div key={s.season} className="card p-5">
              <div className="font-medium">{s.season}</div>
              <div className="text-sm text-teal mt-1">{s.promo}</div>
              <div className="text-xs text-ink/55 mt-1">{s.note}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
