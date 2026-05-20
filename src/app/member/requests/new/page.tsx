import { requireRole } from "@/lib/auth";
import { formatMYR } from "@/lib/format";
import RequestForm from "./request-form";

type SearchParams = Promise<{ car_id?: string; from?: string; to?: string }>;

// datetime-local needs "YYYY-MM-DDTHH:mm" in local time. Strip Z/offset and seconds.
function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default async function NewRequestPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireRole(["member", "admin"]);
  const { car_id, from, to } = await searchParams;

  let targetCar = null;
  if (car_id) {
    const { data } = await supabase
      .from("cars")
      .select("id, make, model, car_type, daily_rate, service_areas(area)")
      .eq("id", car_id)
      .single();
    targetCar = data;
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">
        {targetCar ? "Request this car" : "New request"}
      </h1>
      {targetCar && (
        <div className="mb-4 text-sm bg-slate-50 border border-slate-200 rounded p-3">
          Direct request for <strong>{targetCar.make} {targetCar.model}</strong> &middot;{" "}
          {targetCar.car_type} &middot; {formatMYR(targetCar.daily_rate)}/day
        </div>
      )}
      <RequestForm
        carId={targetCar?.id ?? null}
        defaultCarType={targetCar?.car_type ?? ""}
        defaultArea={targetCar?.service_areas?.[0]?.area ?? ""}
        defaultStartAt={toLocalInput(from)}
        defaultEndAt={toLocalInput(to)}
      />
    </div>
  );
}
