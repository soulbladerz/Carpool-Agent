import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-100 blur-3xl opacity-60" />
        <div className="absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative px-6 py-14 sm:px-12 sm:py-20 max-w-3xl">
          <span className="badge-green mb-5">For Malaysian rental agents &amp; owners</span>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold leading-[1.05] tracking-tight">
            Source cars from the network when yours are full.
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-2xl">
            List your cars, post requests for your customers, and let other members fill the gaps.
            Your customer details stay with you — owners only ever see the pickup area, dates and passenger count.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary px-5 py-3 text-base">Join the network</Link>
            <Link href="/login" className="btn-outline px-5 py-3 text-base">Log in</Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="font-display text-2xl font-bold text-center">How it works</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          <Step n={1} title="List your cars" body="Add make, model, daily rate, deposit, photos, and the areas you service." />
          <Step n={2} title="Post a request" body="Have a customer but no matching car? Post a request — other members offer cars from their fleet." />
          <Step n={3} title="Pick &amp; confirm" body="Choose the offer you like. The owner confirms — and your customer info never leaves you." />
        </div>
      </section>

      {/* Trust strip */}
      <section className="card p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div>
          <h3 className="font-display text-xl font-bold">Privacy built in</h3>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Direct requests stay private to the targeted owner. Customer name and phone are never shared with the car owner.
          </p>
        </div>
        <Link href="/signup" className="btn-primary shrink-0">Get started</Link>
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="card card-hover p-6">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white font-display font-bold">{n}</span>
      <h3 className="mt-4 font-semibold text-lg" dangerouslySetInnerHTML={{ __html: title }} />
      <p className="mt-1.5 text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
}
