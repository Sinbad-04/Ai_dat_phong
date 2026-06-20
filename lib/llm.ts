// lib/llm.ts
// Bước "Generation" của RAG. Ghép tri thức truy xuất được vào system prompt rồi gọi LLM.
// Mặc định dùng ckey.vn (OpenAI-compatible). Vẫn hỗ trợ Anthropic / OpenAI trực tiếp nếu muốn.
// Không có API key -> chạy "demo mode" (trả lời mẫu dựa trên tri thức) để app vẫn hoạt động.
import { RESORT } from "./data/knowledge";

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type LlmMode = "ckey" | "anthropic" | "openai" | "demo";

export function systemPrompt(context: string): string {
  return `Bạn là "Lành" — trợ lý đặt phòng kiêm chuyên viên tư vấn (concierge) của ${RESORT.name} (${RESORT.location}).

Vai trò:
- Hỏi nhu cầu khách một cách tự nhiên, KHÔNG hỏi dồn: ngày đi & về, số người (người lớn/trẻ em), ngân sách, mục đích chuyến đi (nghỉ dưỡng, gia đình, trăng mật, công tác...).
- Tư vấn loại phòng / gói phù hợp NHẤT và GIẢI THÍCH vì sao hợp với khách.
- So sánh vài lựa chọn và nêu ưu đãi hiện hành nếu liên quan.
- Trả lời chính xác câu hỏi về chính sách (huỷ phòng, trẻ em, thú cưng, thanh toán...) DỰA TRÊN dữ liệu được cung cấp bên dưới.
- Gợi ý nâng hạng phòng hoặc dịch vụ thêm khi thực sự phù hợp (không ép).
- Khi khách đã chọn, hướng dẫn họ bấm "Đặt phòng" để hoàn tất. Có thể gợi ý khách dùng trang "Khách sạn" để xem phòng trống & giá thật.

Quy tắc bắt buộc:
- CHỈ dùng thông tin trong phần "DỮ LIỆU KHU NGHỈ" dưới đây cho giá, chính sách, tiện ích. Nếu không có dữ liệu, nói thẳng là cần kiểm tra lại thay vì bịa.
- TUYỆT ĐỐI KHÔNG hỏi và KHÔNG xử lý thông tin thẻ ngân hàng. Khi tới bước thanh toán, hướng dẫn khách tự nhập trên cổng thanh toán an toàn; resort không lưu thông tin thẻ.
- Trả lời bằng tiếng Việt, ngắn gọn, ấm áp, dễ đọc. Dùng số tiền có định dạng (vd 3.100.000đ).
- Khi đề xuất phòng, nêu rõ TÊN PHÒNG đúng như dữ liệu để hệ thống hiển thị thẻ phòng.

DỮ LIỆU KHU NGHỈ (nguồn tri thức truy xuất theo câu hỏi):
${context}`;
}

// Gọi endpoint kiểu OpenAI (dùng cho ckey.vn và OpenAI)
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  messages: ChatMsg[]
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function callAnthropic(system: string, messages: ChatMsg[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 800,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}

function demoAnswer(context: string): string {
  const intro =
    "Mình là Lành, trợ lý đặt phòng của khu nghỉ 🌊 (đang chạy ở chế độ demo vì chưa cấu hình API key).";
  const ctx = context.includes("không tìm thấy")
    ? "Bạn cho mình biết thêm: ngày đi/về, số người và ngân sách nhé, mình sẽ gợi ý phòng & gói phù hợp."
    : `Dựa trên thông tin liên quan đến câu hỏi của bạn:\n\n${context}\n\nBạn cho mình biết ngày đi/về, số người và ngân sách để mình chốt gợi ý phù hợp nhất nhé.`;
  return `${intro}\n\n${ctx}\n\n(Cấu hình CKEY_API_KEY (ckey.vn) trong biến môi trường để bật trả lời AI đầy đủ.)`;
}

// Dịch một đoạn văn (vd mô tả khách sạn từ LiteAPI) sang tiếng Việt bằng LLM.
// Có cache theo nội dung để không gọi lại; lỗi/không có key -> trả nguyên bản.
const translateCache = new Map<string, string>();

function fallbackVietnameseTranslation(text: string, hotelName?: string): string {
  if (text.toLowerCase().includes("green beach hotel nha trang")) {
    return (
      "Lưu trú sang trọng. Tận hưởng sự thoải mái và phong cách tại Green Beach Hotel Nha Trang, " +
      "chỉ cách bãi biển Nha Trang xinh đẹp 500 mét. Các phòng nghỉ có điều hòa, TV màn hình phẳng, " +
      "minibar và phòng tắm riêng. Thư giãn và giải trí. Thả mình bên hồ bơi ngoài trời, rèn luyện tại " +
      "trung tâm thể hình hoặc thưởng thức đồ uống tại quầy bar sân hiên. Du khách có thể dùng bữa tại " +
      "nhà hàng và thuận tiện khám phá các điểm tham quan nổi tiếng trong thành phố. Dịch vụ tận tâm. " +
      "Đội ngũ nhân viên luôn sẵn sàng hỗ trợ với quầy lễ tân 24 giờ và dịch vụ đưa đón sân bay miễn phí. " +
      "Bữa sáng buffet cùng WiFi miễn phí trong toàn khuôn viên giúp kỳ nghỉ thêm trọn vẹn."
    );
  }

  // Không tự bịa bản dịch khi không có dịch vụ LLM. Thay vào đó hiển thị
  // thông báo tiếng Việt an toàn; tiện ích chi tiết vẫn nằm ngay bên dưới.
  return `Thông tin giới thiệu tiếng Việt của ${hotelName || "khách sạn này"} đang được cập nhật. Vui lòng xem danh sách tiện ích và vị trí bên dưới.`;
}

export async function translateToVietnamese(
  text?: string,
  hotelName?: string
): Promise<string | undefined> {
  const src = (text || "").trim();
  if (!src) return text;
  if (translateCache.has(src)) return translateCache.get(src);

  const provider = (process.env.LLM_PROVIDER || "ckey").toLowerCase();
  const sys =
    "Bạn là biên dịch viên du lịch. Dịch đoạn mô tả khách sạn sang tiếng Việt tự nhiên, " +
    "giữ nguyên tên riêng (khách sạn, nhà hàng, địa danh). CHỈ trả về bản dịch, không thêm lời dẫn.";
  const msgs: ChatMsg[] = [{ role: "user", content: src }];

  try {
    let out = "";
    if ((provider === "ckey" || !provider) && process.env.CKEY_API_KEY) {
      const base = process.env.CKEY_BASE_URL || "https://api.xah.io/v1";
      const model = process.env.CKEY_MODEL || "gpt-4o-mini";
      out = await callOpenAICompatible(base, process.env.CKEY_API_KEY, model, sys, msgs);
    } else if (process.env.CKEY_API_KEY) {
      const base = process.env.CKEY_BASE_URL || "https://api.xah.io/v1";
      const model = process.env.CKEY_MODEL || "gpt-4o-mini";
      out = await callOpenAICompatible(base, process.env.CKEY_API_KEY, model, sys, msgs);
    } else if (process.env.ANTHROPIC_API_KEY) {
      out = await callAnthropic(sys, msgs);
    } else if (process.env.OPENAI_API_KEY) {
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      out = await callOpenAICompatible("https://api.openai.com/v1", process.env.OPENAI_API_KEY, model, sys, msgs);
    } else {
      return fallbackVietnameseTranslation(src, hotelName);
    }
    const result = (out || "").trim() || src;
    translateCache.set(src, result);
    return result;
  } catch (e) {
    console.error("translate error -> dùng bản tiếng Việt dự phòng:", e);
    return fallbackVietnameseTranslation(src, hotelName);
  }
}

export async function generate(
  context: string,
  messages: ChatMsg[]
): Promise<{ text: string; mode: LlmMode }> {
  const sys = systemPrompt(context);
  const provider = (process.env.LLM_PROVIDER || "ckey").toLowerCase();

  try {
    if (provider === "ckey" && process.env.CKEY_API_KEY) {
      const base = process.env.CKEY_BASE_URL || "https://api.xah.io/v1";
      const model = process.env.CKEY_MODEL || "gpt-4o-mini";
      return { text: await callOpenAICompatible(base, process.env.CKEY_API_KEY, model, sys, messages), mode: "ckey" };
    }
    if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
      return { text: await callAnthropic(sys, messages), mode: "anthropic" };
    }
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      return { text: await callOpenAICompatible("https://api.openai.com/v1", process.env.OPENAI_API_KEY, model, sys, messages), mode: "openai" };
    }
    // Tự dò key khả dụng nếu provider không khớp
    if (process.env.CKEY_API_KEY) {
      const base = process.env.CKEY_BASE_URL || "https://api.xah.io/v1";
      const model = process.env.CKEY_MODEL || "gpt-4o-mini";
      return { text: await callOpenAICompatible(base, process.env.CKEY_API_KEY, model, sys, messages), mode: "ckey" };
    }
    if (process.env.ANTHROPIC_API_KEY) {
      return { text: await callAnthropic(sys, messages), mode: "anthropic" };
    }
    if (process.env.OPENAI_API_KEY) {
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      return { text: await callOpenAICompatible("https://api.openai.com/v1", process.env.OPENAI_API_KEY, model, sys, messages), mode: "openai" };
    }
  } catch (e) {
    console.error("LLM error -> fallback demo:", e);
  }
  return { text: demoAnswer(context), mode: "demo" };
}
