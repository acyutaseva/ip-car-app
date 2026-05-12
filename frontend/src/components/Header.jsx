export default function Header({ title }) {
  return (
    <header className="surface-panel mb-5 rounded-3xl px-5 py-4 md:px-7 md:py-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 md:text-slate-500">
            Vehicle System
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 md:text-slate-600">
            ISKCON Perth Vehicle Management
          </p>
        </div>

        <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-lg text-white md:flex">
          🚘
        </div>
      </div>
    </header>
  );
}
