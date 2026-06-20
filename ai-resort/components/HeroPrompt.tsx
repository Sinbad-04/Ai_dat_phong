"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CHIPS = [
  "Cặp đôi đi trăng mật 3 đêm",
  "Gia đình 2 người lớn 2 trẻ em",
  "Chính sách huỷ phòng thế nào?",
  "Đi công tác cần wifi tốt",
];

export default function HeroPrompt() {
  const [q, setQ] = useState("");
  const router = useRouter();

  function go(text: string) {
    const t = text.trim();
    if (!t) return;
    router.push(`/assistant?q=${encodeURIComponent(t)}`);
  }

  return (
    <div className="mt-7 max-w-xl">
      <div className="card p-1.5 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go(q)}
          placeholder="Vd: 2 vợ chồng + 1 bé, 3 đêm, tầm 6 triệu/đêm…"
          className="flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-ink/40"
          aria-label="Câu hỏi cho trợ lý"
        />
        <button onClick={() => go(q)} className="btn-primary shrink-0">Hỏi Lành →</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => go(c)}
            className="text-xs rounded-full border border-teal/15 px-3 py-1.5 text-ink/60 hover:border-teal hover:text-teal transition"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
