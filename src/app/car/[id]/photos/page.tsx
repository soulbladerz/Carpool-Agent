import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Public, no-login car photo gallery — a single link an agent can forward to a
// customer. Only exposes car make/model/year + photos (non-sensitive).
export default async function CarGallery({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: car } = (await admin
    .from("cars")
    .select("make, model, year, car_type, photo_urls")
    .eq("id", id)
    .single()) as { data: any };

  const photos: string[] = car?.photo_urls ?? [];

  if (!car || photos.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h1 className="text-lg font-semibold">No photos</h1>
          <p className="text-sm text-slate-600">There are no photos for this car yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">
          {car.make} {car.model} {car.year ? `(${car.year})` : ""}
        </h1>
        <p className="text-sm text-slate-500">{car.car_type}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {photos.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt="Car" className="w-full rounded-lg border border-slate-200 object-cover" />
        ))}
      </div>
    </div>
  );
}
