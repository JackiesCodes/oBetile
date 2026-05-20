import Link from "next/link";
import { redirect } from "next/navigation";
import { sports } from "@/data/matches";

export default function SportPage({ params }: { params: { sport: string } }) {
  if (params.sport === "soccer") {
    redirect("/");
  }

  const sport = sports.find((s) => s.id === params.sport);

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 py-24 px-6 text-center">
      <span className="text-7xl">{sport?.icon ?? "🏅"}</span>
      <div className="space-y-2">
        <h1 className="text-white text-3xl font-bold font-rajdhani">
          {sport?.name ?? params.sport}
        </h1>
        <p className="text-gray-400 text-sm max-w-xs">
          Insights and predictions for this sport are coming soon. Stay tuned!
        </p>
      </div>
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-green text-black text-sm font-bold rounded-lg hover:bg-brand-green-hover transition-colors font-rajdhani"
      >
        ← Back to Soccer
      </Link>
    </div>
  );
}
