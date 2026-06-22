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
  flags: z.object({ skipArea: z.boolean(), skipBudget: z.boolean(), wantsDifferentArea: z.boolean() }),
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
  if (/huỷ|hủy|trẻ em|thú cưng|thanh toán|đặt cọc|check-?in|check-?out/i.test(normalized)) return "policy_question";
  if (/đặt phòng|đơn của tôi|đặt thế nào|thanh toán thế nào/i.test(normalized)) return "booking_help";
  if (destination) return "hotel_search";
  return "general";
}

export function buildConciergeContext(messages: Message[]): ConciergeContext {
  const cleanMessages = messages.map((message) => ({ ...message, content: message.content.trim() })).filter((message) => message.content);
  const userMessages = cleanMessages.filter((message) => message.role === "user").map((message) => message.content);
  const lastUserMessage = userMessages.at(-1) || "";

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
  const stay = latestEntry(userMessages, parseStayDates)?.value || null;
  const guests = latestEntry(userMessages, parseGuests)?.value || null;
  const availableAreas = destination ? areasForDestination(destination).map((item) => item.label) : [];
  const missingSlots: ConciergeContext["missingSlots"] = [];
  if (destination && availableAreas.length > 0 && !area && !skipArea) missingSlots.push("area");
  if (destination && !stay) missingSlots.push("dates");
  if (destination && !guests) missingSlots.push("guests");
  if (destination && !maxNightlyBudget && !skipBudget) missingSlots.push("budget");

  return conciergeContextSchema.parse({
    version: 1,
    intent: fallbackIntent(lastUserMessage, destination),
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
    flags: { skipArea, skipBudget, wantsDifferentArea: wantsDifferentArea(lastUserMessage) },
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
