import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="text-center space-y-4 py-12">
        <h1 className="text-4xl font-bold">Rentable cars, ready when you are.</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Carpool Agent connects independent car owners with rental agents.
          Owners list their cars with rates, deposits, and service areas.
          Agents browse availability and flag a car when they have a customer.
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Link href="/signup?role=owner" className="rounded bg-brand text-white px-4 py-2 hover:bg-brand-dark">
            I&apos;m an owner
          </Link>
          <Link href="/signup?role=agent" className="rounded border border-brand text-brand px-4 py-2 hover:bg-brand/5">
            I&apos;m an agent
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <Card title="List your car" body="Add make, model, daily rate, deposit, and the areas you service." />
        <Card title="Set availability" body="Toggle a car between available and not. No calendar wrestling." />
        <Card title="Flag &amp; hold" body="Agents flag a car when they have a customer; the owner confirms." />
      </section>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm border border-slate-200">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
}
