import { useEffect, useState } from "react";
import API, { UPLOADS_BASE_URL } from "../services/api";
import Navbar from "../components/Navbar";
import Header from "../components/Header";

const parsePhoneInput = (value) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function SearchCar() {
  const [search, setSearch] = useState("");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [editingCar, setEditingCar] = useState(null);
  const [editForm, setEditForm] = useState({
    car_number: "",
    owner_name: "",
    phonesText: "",
    photos: [],
  });
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const imageBaseUrl = UPLOADS_BASE_URL;

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("recentSearches")) || [];
    setRecentSearches(stored);
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setCars([]);
      return;
    }

    const timer = setTimeout(() => {
      searchCars(search);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const searchCars = async (query) => {
    try {
      setLoading(true);
      const res = await API.get(`/cars/search/${query}`);
      setCars(res.data);

      let updatedSearches = [query, ...recentSearches.filter((s) => s !== query)];
      updatedSearches = updatedSearches.slice(0, 5);
      setRecentSearches(updatedSearches);
      localStorage.setItem("recentSearches", JSON.stringify(updatedSearches));
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCar = async (carId, carNumber) => {
    const confirmed = window.confirm(`Delete car ${carNumber}?`);

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(carId);
      await API.delete(`/cars/delete/${carId}`);
      setCars((prevCars) => prevCars.filter((car) => car.id !== carId));
    } catch (error) {
      alert("Failed to delete car");
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (car) => {
    setEditingCar(car);
    setEditForm({
      car_number: car.car_number || "",
      owner_name: car.owner_name || "",
      phonesText: (car.phone_numbers || []).join(", "),
      photos: [],
    });
  };

  const closeEditModal = () => {
    setEditingCar(null);
    setEditForm({
      car_number: "",
      owner_name: "",
      phonesText: "",
      photos: [],
    });
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editingCar) {
      return;
    }

    const phone_numbers = parsePhoneInput(editForm.phonesText);

    if (!editForm.car_number.trim() || !editForm.owner_name.trim()) {
      alert("Car number and owner name are required");
      return;
    }

    if (phone_numbers.length === 0) {
      alert("At least one phone number is required");
      return;
    }

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("car_number", editForm.car_number.trim().toUpperCase());
      formData.append("owner_name", editForm.owner_name.trim());
      formData.append("phone_numbers", JSON.stringify(phone_numbers));

      editForm.photos.forEach((photo) => {
        formData.append("photos", photo);
      });

      await API.put(`/cars/edit/${editingCar.id}`, formData);

      await searchCars(search);
      closeEditModal();
    } catch (error) {
      alert("Failed to update car");
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <Header title="Search Car" />

      <section className="surface-panel rounded-3xl p-5 md:p-6">
        <input
          type="text"
          placeholder="Search by Car Number or Owner Name..."
          className="mb-4 w-full rounded-2xl border border-slate-300 bg-white p-4 text-lg text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {recentSearches.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-sm text-slate-500">Recent Searches</p>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setSearch(item)}
                  className="rounded-full bg-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="py-4 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-slate-900"></div>
            <p className="mt-2 text-slate-500">Searching...</p>
          </div>
        )}

        <div className="space-y-4">
          {cars.map((car) => (
            <div key={car.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              {(car.photos || []).length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {car.photos.map((photoName, photoIndex) => (
                    <button
                      key={`${car.id}-${photoName}-${photoIndex}`}
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          src: `${imageBaseUrl}/${photoName}`,
                          alt: `${car.car_number}-${photoIndex + 1}`,
                        })
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
                    onClick={() => openEditModal(car)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCar(car.id, car.car_number)}
                    disabled={deletingId === car.id}
                    aria-label={`Delete car ${car.car_number}`}
                    title="Delete car"
                    className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-600 text-sm text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === car.id ? "…" : "🗑"}
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
          ))}

          {!loading && search && cars.length === 0 && (
            <div className="py-10 text-center text-slate-500">No cars found</div>
          )}
        </div>
      </section>

      {editingCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-slate-900">Edit Car {editingCar.car_number}</h3>

            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                placeholder="Car Number"
                value={editForm.car_number}
                onChange={(e) => setEditForm((prev) => ({ ...prev, car_number: e.target.value }))}
              />

              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                placeholder="Owner Name"
                value={editForm.owner_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, owner_name: e.target.value }))}
              />

              <textarea
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                rows={3}
                placeholder="Phone numbers separated by comma or new line"
                value={editForm.phonesText}
                onChange={(e) => setEditForm((prev) => ({ ...prev, phonesText: e.target.value }))}
              />

              <input
                type="file"
                accept="image/*"
                multiple
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-700"
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, photos: Array.from(e.target.files || []) }))
                }
              />
              <p className="text-xs text-slate-500">
                Uploading new images will replace existing images for this car.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeEditModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-lg text-white"
              aria-label="Close image preview"
            >
              ✕
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-h-[85vh] w-full rounded-2xl bg-black object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
