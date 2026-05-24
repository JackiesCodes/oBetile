import { Sport } from "@/types";

export const sports: Sport[] = [
  { id: "soccer", name: "Soccer", icon: "⚽", liveCount: 111 },
  { id: "tennis", name: "Tennis", icon: "🎾", liveCount: 9 },
  { id: "basketball", name: "Basketball", icon: "🏀", liveCount: 32 },
  { id: "cricket", name: "Cricket", icon: "🏏", liveCount: 3 },
  { id: "rugby-union", name: "Rugby Union", icon: "🏉", liveCount: 1 },
  { id: "table-tennis", name: "Table Tennis", icon: "🏓", liveCount: 7 },
  { id: "baseball", name: "Baseball", icon: "⚾", liveCount: 33 },
  { id: "boxing", name: "Boxing", icon: "🥊" },
  { id: "golf", name: "Golf", icon: "⛳", liveCount: 8 },
  { id: "handball", name: "Handball", icon: "🤾", liveCount: 1 },
  { id: "cycling", name: "Cycling", icon: "🚴", liveCount: 6 },
  { id: "snooker", name: "Snooker", icon: "🎱", liveCount: 1 },
  { id: "esports", name: "eSports", icon: "🎮" },
  { id: "netball", name: "Netball", icon: "🥅" },
];

export const countryFlags: Record<string, string> = {
  Portugal: "🇵🇹",
  Netherlands: "🇳🇱",
  Turkiye: "🇹🇷",
  "Saudi Arabia": "🇸🇦",
  Israel: "🇮🇱",
  Norway: "🇳🇴",
  Spain: "🇪🇸",
  Italy: "🇮🇹",
  USA: "🇺🇸",
  Belgium: "🇧🇪",
  Ireland: "🇮🇪",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Germany: "🇩🇪",
  France: "🇫🇷",
  "International Clubs": "🌍",
};
