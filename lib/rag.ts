// lib/rag.ts
// Bước "Retrieval" của RAG: chấm điểm độ liên quan giữa câu hỏi và các đoạn tri thức,
// lấy top-k để đưa vào prompt. Dùng matching không phụ thuộc dấu tiếng Việt nên gọn,
// nhanh, chạy offline (không cần API embeddings). Đủ tốt vì kho tri thức nhỏ & tĩnh.
import { buildKnowledgeDocs, type Doc } from "./data/knowledge";

const DOCS: Doc[] = buildKnowledgeDocs();

function deburr(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}
function tokens(s: string): string[] {
  return deburr(s.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

const STOP = new Set([
  "va","la","co","cua","cho","mot","cac","nhu","the","nao","duoc","khi","den",
  "voi","hay","thi","ban","minh","toi","muon","can","ve","tai","trong","ra","di",
]);

export function retrieve(query: string, k = 5): Doc[] {
  const qt = tokens(query).filter((t) => !STOP.has(t));
  if (qt.length === 0) return DOCS.slice(0, k);

  const scored = DOCS.map((d) => {
    const haystack = tokens(d.title + " " + d.text);
    const hay = new Set(haystack);
    let score = 0;
    for (const t of qt) {
      if (hay.has(t)) score += 2;
      else if (haystack.some((h) => h.includes(t) || t.includes(h))) score += 1;
    }
    // ưu tiên nhẹ theo category nếu câu hỏi nhắc tới
    const cat = deburr(query.toLowerCase());
    if (cat.includes("huy") || cat.includes("policy") || cat.includes("chinh sach")) {
      if (d.category === "policy") score += 1;
    }
    if (cat.includes("tre em") || cat.includes("be") || cat.includes("con")) {
      if (d.id.includes("tre em")) score += 3;
    }
    if (cat.includes("thu cung") || cat.includes("cho") || cat.includes("meo")) {
      if (d.id.includes("thu cung")) score += 3;
    }
    return { d, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.d);
}

export function contextBlock(docs: Doc[]): string {
  if (docs.length === 0) return "(không tìm thấy mục tri thức khớp — trả lời theo hiểu biết chung và mời khách hỏi rõ hơn)";
  return docs.map((d, i) => `[${i + 1}] ${d.title}\n${d.text}`).join("\n\n");
}
