import { requireRole } from "@/lib/auth";
import CarForm from "../car-form";

export default async function NewCarPage() {
  await requireRole("owner");
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">Add a car</h1>
      <CarForm />
    </div>
  );
}
