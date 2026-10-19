import { ReviewStatus } from "@/lib/types";

export default function ReviewBadge({ status }: { status: ReviewStatus | undefined }) {
  if (status === "pending") {
    return (
      <span
        title="Not reviewed yet this round — run Smart Notes or mark it as having no updates"
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-navy-600 bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-navy-700"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-navy-600" />
        Unreviewed
      </span>
    );
  }
  if (status === "reviewed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
        ✓ Reviewed
      </span>
    );
  }
  return null;
}
