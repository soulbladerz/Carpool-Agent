import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="text-center space-y-4 py-12">
        <h1 className="text-4xl font-bold">Source cars from the network when yours are full.</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Carpool Agent connects rental members to one another. List your cars,
          post requests for your customers, and let the network fill the gaps.
          Customer details stay with you — owners only see pickup area, dates,
          and passenger count.
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Link href="/signup" className="rounded bg-brand text-white px-4 py-2 hover:bg-brand-dark">
            Join the network
          </Link>
          <Link href="/login" className="rounded border border-brand text-brand px-4 py-2 hover:bg-brand/5">
            Log in
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <Card title="List your cars" body="Add make, model, daily rate, deposit, and the areas you service." />
        <Card title="Post a request" body="Have a customer but no matching car? Post a request — other members offer cars from their fleet." />
        <Card title="Pick and confirm" body="Choose the offer you like. The car owner confirms; customer info never leaves you." />
      </section>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm border border-slate-200">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{body}</p>
    </div>
  );
}
