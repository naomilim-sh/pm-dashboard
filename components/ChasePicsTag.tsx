import { ChaseLevel } from "@/lib/projectStatus";

export default function ChasePicsTag({ level }: { level: ChaseLevel }) {
  if (!level) return null;
  return (
    <span
      title={level === "two_weeks" ? "Deadline is within 2 weeks" : "Deadline is within a month"}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
        level === "two_weeks"
          ? "bg-shopee text-white shadow-sm shadow-shopee/30"
          : "border border-shopee-300 bg-shopee-50 text-shopee-700"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${level === "two_weeks" ? "bg-white" : "bg-shopee"}`} />
      Chase PICs?
    </span>
  );
}
