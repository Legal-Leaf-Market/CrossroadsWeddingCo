import type { ChatMessage } from "@/components/messages/ChatThread";

// Shared sample conversation for the dev-only messages previews.
export const SAMPLE_THREAD: ChatMessage[] = [
  {
    id: "s1",
    sender: "couple",
    senderName: "Jordan Hayes & Taylor Morgan",
    body: "Hey! Quick question: can the acoustic set start 15 minutes earlier? Guests are arriving at 3:45 now.",
    createdAt: "2026-08-27T14:05:00.000Z",
  },
  {
    id: "s2",
    sender: "team",
    senderName: "Jake",
    body: "Absolutely. I moved the prelude block to 3:45 on your timeline. Nothing else shifts.",
    createdAt: "2026-08-27T14:22:00.000Z",
  },
  {
    id: "s3",
    sender: "team",
    senderName: "Nic",
    body: "And I'll be set up and playing by 3:40 so the first guests walk into music.",
    createdAt: "2026-08-27T14:31:00.000Z",
  },
  {
    id: "s4",
    sender: "couple",
    senderName: "Jordan Hayes & Taylor Morgan",
    body: "You two are the best. Thank you!",
    createdAt: "2026-08-27T15:02:00.000Z",
  },
];
