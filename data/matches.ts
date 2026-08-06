import { Sport } from "@/types";

// No liveCount here. Only soccer has a real data source (API-Football), and the
// homepage fills its count in from the live fixtures endpoint. Every other sport
// previously carried an invented number, so the tab bar advertised e.g.
// "Basketball 32" live when the app has no basketball data at all and the sport
// page says "coming soon".
export const sports: Sport[] = [
  { id: "soccer", name: "Soccer", icon: "⚽" },
  { id: "tennis", name: "Tennis", icon: "🎾" },
  { id: "basketball", name: "Basketball", icon: "🏀" },
  { id: "cricket", name: "Cricket", icon: "🏏" },
  { id: "rugby-union", name: "Rugby Union", icon: "🏉" },
  { id: "table-tennis", name: "Table Tennis", icon: "🏓" },
  { id: "baseball", name: "Baseball", icon: "⚾" },
  { id: "boxing", name: "Boxing", icon: "🥊" },
  { id: "golf", name: "Golf", icon: "⛳" },
  { id: "handball", name: "Handball", icon: "🤾" },
  { id: "cycling", name: "Cycling", icon: "🚴" },
  { id: "snooker", name: "Snooker", icon: "🎱" },
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
