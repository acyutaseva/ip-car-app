export default function Header({ title, titleMeta }) {
  return (
    <header className="surface-panel mb-5 rounded-3xl px-5 py-4 md:px-7 md:py-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 md:text-slate-500">
              Vehicle System
            </p>
            <p className="text-[10px] text-slate-500 md:text-xs md:text-slate-600">
              ISKCON Perth Vehicle Management
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
              {title}
            </h1>
            {titleMeta && <p className="text-xs text-slate-500 md:text-sm">{titleMeta}</p>}
          </div>
        </div>

        <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-lg text-white md:flex">
          🚘
        </div>
      </div>
    </header>
  );
}
