import Link from "next/link";
import { ROOMS, PACKAGES, RESORT } from "@/lib/data/knowledge";
import RoomCard from "@/components/RoomCard";
import HeroPrompt from "@/components/HeroPrompt";
import { vnd } from "@/lib/format";

export default function Home() {
  const featured = ROOMS.filter((r) => ["deluxe-ocean", "honeymoon-villa", "family-suite"].includes(r.id));

  return (
    <div>
      {/* HERO — thesis: hỏi concierge */}
      <section className="relative overflow-hidden">
        <div className="container-px pt-16 pb-14 sm:pt-24 sm:pb-20 grid lg:grid-cols-[1.05fr,.95fr] gap-12 items-center">
          <div className="animate-rise">
            <span className="eyebrow">{RESORT.location}</span>
            <h1 className="mt-4 font-display text-4xl sm:text-5xl lg:text-[3.4rem] leading-[1.05]">
              Đừng dò website.
              <br />
              <span className="text-jade">Hỏi concierge</span> một câu.
            </h1>
            <p className="mt-5 text-lg text-ink/70 max-w-xl">
              Hàng chục loại phòng, gói combo, ưu đãi theo mùa — Lành, trợ lý AI của {RESORT.name},
              hỏi đúng nhu cầu của bạn rồi gợi ý phòng & gói phù hợp nhất, giải đáp mọi chính sách. Có mặt 24/7.
            </p>
            <HeroPrompt />
          </div>

          <div className="relative animate-rise">
            <div className="card p-6 rotate-1">
              <div className="flex items-center gap-2 mb-4">
                <span className="h-2.5 w-2.5 rounded-full bg-jade animate-pulse" />
                <span className="text-sm text-ink/60">Lành đang trực tuyến</span>
              </div>
              <Bubble who="khach">Nhà mình 2 vợ chồng + bé 4 tuổi, đi 3 đêm cuối tháng, tầm 6 triệu/đêm thì ở phòng nào?</Bubble>
              <Bubble who="ai">
                Với gia đình có bé nhỏ, mình gợi ý <b>Family Suite 2 phòng ngủ</b> (75m², gần hồ bơi & khu trẻ em).
                Bé 4 tuổi <b>miễn phí lưu trú</b> khi ngủ chung. Đi 3 đêm hợp với <b>Gói Gia Đình Vui Khoẻ</b>.
              </Bubble>
              <Bubble who="khach">Huỷ phòng có mất phí không?</Bubble>
              <Bubble who="ai">Huỷ <b>miễn phí trước 7 ngày</b> nhận phòng. Trong 3–7 ngày phí 50% đêm đầu.</Bubble>
            </div>
            <div className="absolute -bottom-5 -left-4 card px-4 py-3 -rotate-2 hidden sm:block">
              <div className="text-[11px] text-ink/50">Từ</div>
              <div className="font-mono text-teal">{vnd(2200000)}/đêm</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container-px py-12">
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            ["01", "Kể nhu cầu", "Ngày đi, số người, ngân sách, mục đích — bằng ngôn ngữ tự nhiên."],
            ["02", "Nhận gợi ý", "AI so sánh phòng & gói, giải thích vì sao hợp và nêu ưu đãi đang có."],
            ["03", "Chốt đặt phòng", "Xem lại, chọn phòng và hoàn tất. Bạn tự nhập thanh toán an toàn."],
          ].map(([n, t, d]) => (
            <div key={n} className="card p-6">
              <span className="font-mono text-sm text-sunset">{n}</span>
              <h3 className="font-display text-xl mt-2">{t}</h3>
              <p className="text-sm text-ink/65 mt-2">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED ROOMS */}
      <section className="container-px py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <span className="eyebrow">Lưu trú</span>
            <h2 className="font-display text-3xl mt-2">Phòng & villa nổi bật</h2>
          </div>
          <Link href="/rooms" className="btn-ghost">Xem tất cả</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featured.map((r) => (
            <RoomCard key={r.id} room={r} />
          ))}
        </div>
      </section>

      {/* PACKAGES */}
      <section className="container-px py-12">
        <span className="eyebrow">Trải nghiệm trọn gói</span>
        <h2 className="font-display text-3xl mt-2 mb-6">Gói nghỉ dưỡng theo mục đích</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PACKAGES.map((p) => (
            <div key={p.id} className="card p-5 flex flex-col">
              <h3 className="font-display text-lg">{p.name}</h3>
              <p className="text-xs text-jade mt-1">{p.forWho}</p>
              <ul className="mt-3 space-y-1 text-sm text-ink/65 flex-1">
                {p.includes.slice(0, 3).map((i) => (
                  <li key={i} className="flex gap-2"><span className="text-jade">•</span>{i}</li>
                ))}
              </ul>
              <div className="mt-4 font-mono text-teal">Từ {vnd(p.fromPrice)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-px py-12">
        <div className="card p-8 sm:p-12 text-center bg-gradient-to-br from-teal to-midnight text-mist">
          <h2 className="font-display text-3xl sm:text-4xl">Sẵn sàng cho kỳ nghỉ tiếp theo?</h2>
          <p className="mt-3 text-mist/80 max-w-xl mx-auto">
            Hỏi Lành bất cứ điều gì về phòng, gói, ưu đãi hay chính sách. Trả lời trong vài giây.
          </p>
          <Link href="/assistant" className="btn-gold mt-6">Trò chuyện với trợ lý AI →</Link>
        </div>
      </section>
    </div>
  );
}

function Bubble({ who, children }: { who: "khach" | "ai"; children: React.ReactNode }) {
  const isAi = who === "ai";
  return (
    <div className={`mb-2.5 flex ${isAi ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
          isAi ? "bg-teal/8 text-ink rounded-tl-sm" : "bg-sunset/20 text-ink rounded-tr-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
