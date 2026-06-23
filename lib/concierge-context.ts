import { z } from "zod";
import {
  areasForDestination,
  detectDestination,
  detectDestinationArea,
  type Destination,
  type DestinationArea,
} from "./data/destinations";
import {
  asksAboutDestinationHighlights,
  asksForRoomRecommendation,
  declinesAreaPreference,
  declinesBudgetFilter,
  hasHotelSearchSignal,
  isClearlyOutOfScope,
  isGreetingOnly,
  parseGuests,
  parseMaxNightlyBudget,
  parseStayDates,
  wantsDifferentArea,
} from "./travel-query";

export const conciergeIntentSchema = z.enum([
  "greeting",
  "hotel_search",
  "destination_advice",
  "room_recommendation",
  "policy_question",
  "booking_help",
  "out_of_scope",
  "general",
]);
export type ConciergeIntent = z.infer<typeof conciergeIntentSchema>;

const destinationSchema = z.object({
  cityName: z.string(),
  countryCode: z.string(),
  label: z.string(),
  intl: z.boolean().optional(),
});
const areaSchema = z.object({
  value: z.string(),
  label: z.string(),
  cityName: z.string(),
  countryCode: z.string(),
  keywords: z.array(z.string()),
});
const turnSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1_000) });

export const conciergeContextSchema = z.object({
  version: z.literal(1),
  intent: conciergeIntentSchema,
  lastUserMessage: z.string().max(4_000),
  destination: destinationSchema.nullable(),
  area: areaSchema.nullable(),
  stay: z.object({ checkIn: z.string(), checkOut: z.string() }).nullable(),
  guests: z.number().int().min(1).max(9).nullable(),
  maxNightlyBudget: z.number().positive().nullable(),
  purpose: z.string().max(100).nullable(),
  preferences: z.array(z.string().max(100)).max(10),
  availableAreas: z.array(z.string()).max(20),
  missingSlots: z.array(z.enum(["area", "dates", "guests", "budget"])),
  flags: z.object({
    skipArea: z.boolean(),
    skipBudget: z.boolean(),
    wantsDifferentArea: z.boolean(),
    topicChanged: z.boolean(),
  }),
  recentTurns: z.array(turnSchema).max(10),
});
export type ConciergeContext = z.infer<typeof conciergeContextSchema>;
type Message = { role: "user" | "assistant"; content: string };

function latestEntry<T>(values: string[], parser: (value: string) => T | null | undefined) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = parser(values[index]);
    if (value !== null && value !== undefined) return { value, index };
  }
  return null;
}

function latestIndex(values: string[], predicate: (value: string) => boolean): number {
  for (let index = values.length - 1; index >= 0; index -= 1) if (predicate(values[index])) return index;
  return -1;
}

function detectPurpose(values: string[]): string | null {
  const joined = values.join(" ").toLowerCase();
  const purposes = ["trăng mật", "gia đình", "nghỉ dưỡng", "công tác", "khám phá", "city tour"];
  return purposes.find((value) => joined.includes(value)) || null;
}

function detectPreferences(values: string[]): string[] {
  const joined = values.join(" ").toLowerCase();
  return ["gần biển", "hồ bơi", "gần trung tâm", "bữa sáng", "spa", "đưa đón sân bay", "phòng gia đình"]
    .filter((value) => joined.includes(value));
}

function fallbackIntent(lastUser: string, destination: Destination | null): ConciergeIntent {
  const normalized = lastUser.toLowerCase();
  if (isGreetingOnly(lastUser)) return "greeting";
  if (asksAboutDestinationHighlights(lastUser)) return "destination_advice";
  if (asksForRoomRecommendation(lastUser)) return "room_recommendation";
  if (/đặt phòng|đơn của tôi|đặt thế nào|thanh toán thế nào/i.test(normalized)) return "booking_help";
  if (/huỷ|hủy|trẻ em|thú cưng|thanh toán|đặt cọc|check-?in|check-?out/i.test(normalized)) return "policy_question";
  if (isClearlyOutOfScope(lastUser)) return "out_of_scope";
  // Không dùng điểm đến cũ để mặc định mọi tin nhắn mới là tìm khách sạn.
  // Tin nhắn hiện tại phải thực sự chứa một tín hiệu tiếp tục luồng đặt phòng.
  if (destination && (detectDestination(lastUser) || detectDestinationArea(lastUser) || hasHotelSearchSignal(lastUser))) {
    return "hotel_search";
  }
  return "general";
}

export function buildConciergeContext(messages: Message[], options: { now?: Date } = {}): ConciergeContext {
  const cleanMessages = messages.map((message) => ({ ...message, content: message.content.trim() })).filter((message) => message.content);
  const userMessages = cleanMessages.filter((message) => message.role === "user").map((message) => message.content);
  const lastUserMessage = userMessages.at(-1) || "";
  const previousAssistantMessage = [...cleanMessages]
    .reverse()
    .find((message) => message.role === "assistant")?.content || "";

  const destinationEntry = latestEntry(userMessages, detectDestination);
  const destination = (destinationEntry?.value || null) as Destination | null;
  const areaEntry = latestEntry(userMessages, detectDestinationArea);
  const areaSkipIndex = latestIndex(userMessages, declinesAreaPreference);
  const area = destination && areaEntry
    && areaEntry.index >= (destinationEntry?.index ?? -1)
    && areaEntry.index > areaSkipIndex
    && areaEntry.value.cityName === destination.cityName
    && areaEntry.value.countryCode === destination.countryCode
    ? areaEntry.value as DestinationArea
    : null;
  const skipArea = areaSkipIndex >= (destinationEntry?.index ?? 0) && areaSkipIndex > (areaEntry?.index ?? -1);

  const budgetEntry = latestEntry(userMessages, parseMaxNightlyBudget);
  const budgetSkipIndex = latestIndex(userMessages, declinesBudgetFilter);
  const maxNightlyBudget = budgetEntry && budgetEntry.index > budgetSkipIndex ? budgetEntry.value : null;
  const skipBudget = budgetSkipIndex > (budgetEntry?.index ?? -1);
  const stay = latestEntry(userMessages, (value) => parseStayDates(value, options.now))?.value || null;
  const guests = latestEntry(userMessages, parseGuests)?.value || null;
  const availableAreas = destination ? areasForDestination(destination).map((item) => item.label) : [];
  const intent = fallbackIntent(lastUserMessage, destination);
  const previousTurnWasHotelFlow = /khu vực nào|nhận phòng|trả phòng|bao nhiêu khách|ngân sách|đặt phòng/i
    .test(previousAssistantMessage);
  const topicChanged = intent === "out_of_scope" && !!destination && previousTurnWasHotelFlow;
  const missingSlots: ConciergeContext["missingSlots"] = [];
  if (destination && availableAreas.length > 0 && !area && !skipArea) missingSlots.push("area");
  if (destination && !stay) missingSlots.push("dates");
  if (destination && !guests) missingSlots.push("guests");
  if (destination && !maxNightlyBudget && !skipBudget) missingSlots.push("budget");

  return conciergeContextSchema.parse({
    version: 1,
    intent,
    lastUserMessage,
    destination,
    area,
    stay,
    guests,
    maxNightlyBudget,
    purpose: detectPurpose(userMessages),
    preferences: detectPreferences(userMessages),
    availableAreas,
    missingSlots,
    flags: { skipArea, skipBudget, wantsDifferentArea: wantsDifferentArea(lastUserMessage), topicChanged },
    recentTurns: cleanMessages.slice(-10).map((message) => ({ ...message, content: message.content.slice(0, 1_000) })),
  });
}

export function withIntent(context: ConciergeContext, intent: ConciergeIntent, purpose?: string | null, preferences?: string[]) {
  return conciergeContextSchema.parse({
    ...context,
    intent,
    purpose: purpose ?? context.purpose,
    preferences: preferences?.length ? Array.from(new Set([...context.preferences, ...preferences])).slice(0, 10) : context.preferences,
  });
}


function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : v;
}

// Hợp nhất slot do LLM trích xuất (JSON) lên context rule-base. LLM là nguồn chính;
// giá trị nào LLM không chắc thì giữ theo parser. Có kiểm định để không nhận dữ liệu rác.
export function applyLlmSlots(
  baseline: ConciergeContext,
  raw: Record<string, unknown>,
): ConciergeContext {
  let destination = baseline.destination;
  if (typeof raw.destinationCity === "string" && raw.destinationCity.trim()) {
    const d = detectDestination(raw.destinationCity);
    if (d) destination = d as Destination;
  }

  let area = baseline.area;
  if (destination && typeof raw.area === "string" && raw.area.trim()) {
    const a = detectDestinationArea(raw.area);
    if (a && a.cityName === destination.cityName && a.countryCode === destination.countryCode) {
      area = a as DestinationArea;
    }
  }

  let stay = baseline.stay;
  const ci = isoDate(raw.checkIn);
  const co = isoDate(raw.checkOut);
  if (ci && co && co > ci) stay = { checkIn: ci, checkOut: co };

  let guests = baseline.guests;
  if (typeof raw.guests === "number" && raw.guests >= 1 && raw.guests <= 9) {
    guests = Math.round(raw.guests);
  }

  let maxNightlyBudget = baseline.maxNightlyBudget;
  if (typeof raw.maxNightlyBudget === "number" && raw.maxNightlyBudget > 0) {
    maxNightlyBudget = raw.maxNightlyBudget;
  }

  const skipArea = typeof raw.skipArea === "boolean" ? raw.skipArea : baseline.flags.skipArea;
  const skipBudget = typeof raw.skipBudget === "boolean" ? raw.skipBudget : baseline.flags.skipBudget;

  let intent = baseline.intent;
  const parsedIntent = conciergeIntentSchema.safeParse(raw.intent);
  if (parsedIntent.success) intent = parsedIntent.data;

  const purpose =
    typeof raw.purpose === "string" && raw.purpose.trim()
      ? raw.purpose.trim().slice(0, 100)
      : baseline.purpose;

  const preferences = Array.isArray(raw.preferences)
    ? Array.from(
        new Set([
          ...baseline.preferences,
          ...(raw.preferences as unknown[])
            .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
            .map((p) => p.trim().slice(0, 100)),
        ]),
      ).slice(0, 10)
    : baseline.preferences;

  const availableAreas = destination
    ? areasForDestination(destination).map((item) => item.label)
    : [];

  const missingSlots: ConciergeContext["missingSlots"] = [];
  if (destination && availableAreas.length > 0 && !area && !skipArea) missingSlots.push("area");
  if (destination && !stay) missingSlots.push("dates");
  if (destination && !guests) missingSlots.push("guests");
  if (destination && !maxNightlyBudget && !skipBudget) missingSlots.push("budget");

  return conciergeContextSchema.parse({
    ...baseline,
    intent,
    destination,
    area,
    stay,
    guests,
    maxNightlyBudget,
    purpose,
    preferences,
    availableAreas,
    missingSlots,
    flags: { ...baseline.flags, skipArea, skipBudget },
  });
}
