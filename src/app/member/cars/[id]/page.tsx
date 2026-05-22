import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import CarForm from "../car-form";
import CarPhotos from "../car-photos";

export default async function EditCarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireRole(["member", "admin"]);
  const { data: car } = await supabase
    .from("cars")
    .select("*, service_areas(area)")
    .eq("id", id)
    .eq("owner_id", profile.id)
    .single();
  if (!car) notFound();

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-semibold">Edit car</h1>
      <CarForm
        initial={{
          id: car.id,
          make: car.make,
          model: car.model,
          year: car.year ?? "",
          car_type: car.car_type,
          plate: car.plate ?? "",
          daily_rate: car.daily_rate,
          deposit: car.deposit,
          notes: car.notes ?? "",
          areas: (car.service_areas ?? []).map((a: { area: string }) => a.area).join(", ")
        }}
      />
      <CarPhotos carId={car.id} initial={car.photo_urls ?? []} />
    </div>
  );
}
