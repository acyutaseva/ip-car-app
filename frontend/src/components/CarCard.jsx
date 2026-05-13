import { memo } from "react";

function CarCard({ car, imageBaseUrl, isDeleting, onDelete, onEdit, onPreview }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      {(car.photos || []).length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {car.photos.map((photoName, photoIndex) => (
            <button
              key={`${car.id}-${photoName}-${photoIndex}`}
              type="button"
              onClick={() =>
                onPreview(`${imageBaseUrl}/${photoName}`, `${car.car_number}-${photoIndex + 1}`)
              }
              className="overflow-hidden rounded-2xl"
            >
              <img
                src={`${imageBaseUrl}/${photoName}`}
                alt={`${car.car_number}-${photoIndex + 1}`}
                loading="lazy"
                decoding="async"
                className="h-40 w-full object-cover transition hover:scale-[1.02] md:h-48"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate text-2xl font-bold text-slate-900">{car.car_number}</h2>
          <p className="truncate text-sm text-slate-600">{car.owner_name}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(car)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(car.id, car.car_number)}
            disabled={isDeleting}
            aria-label={`Delete car ${car.car_number}`}
            title="Delete car"
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-600 text-sm text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "…" : "🗑"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {(car.phone_numbers || []).map((phone, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3"
          >
            <span className="font-medium text-slate-900">{phone}</span>

            <div className="flex flex-shrink-0 gap-2">
              <a href={`tel:${phone}`} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm text-white">
                Call
              </a>
              <a
                href={`https://wa.me/61${phone.substring(1)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-emerald-700 px-3 py-2 text-sm text-white"
              >
                WhatsApp
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(
  CarCard,
  (prevProps, nextProps) =>
    prevProps.car === nextProps.car &&
    prevProps.imageBaseUrl === nextProps.imageBaseUrl &&
    prevProps.isDeleting === nextProps.isDeleting
);
