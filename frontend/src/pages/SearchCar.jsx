import { useCallback, useEffect, useRef, useState } from "react";
import API, { UPLOADS_BASE_URL } from "../services/api";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import CarCard from "../components/CarCard";

const PAGE_SIZE = 12;

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
    existingPhotos: [],
    photos: [],
  });
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchAbortRef = useRef(null);

  const imageBaseUrl = UPLOADS_BASE_URL;

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("recentSearches")) || [];
    setRecentSearches(stored);
  }, []);

  useEffect(() => {
    return () => {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setCars([]);
      setOffset(0);
      setHasMore(false);
      return;
    }

    const timer = setTimeout(() => {
      searchCars(search, { reset: true });
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const searchCars = async (query, options = {}) => {
    const { reset = false } = options;
    const nextOffset = reset ? 0 : offset;
    let controller = null;

    try {
      if (reset) {
        if (searchAbortRef.current) {
          searchAbortRef.current.abort();
        }
        controller = new AbortController();
        searchAbortRef.current = controller;
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const res = await API.get(`/cars/search/${query}`, {
        params: {
          limit: PAGE_SIZE,
          offset: nextOffset,
        },
        signal: controller ? controller.signal : undefined,
      });
      const payload = res.data?.data || [];
      const pageHasMore = Boolean(res.data?.pagination?.hasMore);

      if (reset) {
        setCars(payload);
      } else {
        setCars((prev) => [...prev, ...payload]);
      }
      setOffset(nextOffset + payload.length);
      setHasMore(pageHasMore);

      if (reset) {
        let updatedSearches = [query, ...recentSearches.filter((s) => s !== query)];
        updatedSearches = updatedSearches.slice(0, 5);
        setRecentSearches(updatedSearches);
        localStorage.setItem("recentSearches", JSON.stringify(updatedSearches));
      }
    } catch (error) {
      if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
        return;
      }
      console.log(error);
    } finally {
      if (controller && searchAbortRef.current === controller) {
        searchAbortRef.current = null;
      }
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const handleDeleteCar = useCallback(async (carId, carNumber) => {
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
  }, []);

  const openEditModal = useCallback((car) => {
    setEditingCar(car);
    setEditForm({
      car_number: car.car_number || "",
      owner_name: car.owner_name || "",
      phonesText: (car.phone_numbers || []).join(", "),
      existingPhotos: car.photos || [],
      photos: [],
    });
  }, []);

  const handlePreviewImage = useCallback((src, alt) => {
    setPreviewImage({ src, alt });
  }, []);

  const closeEditModal = () => {
    setEditingCar(null);
    setEditForm({
      car_number: "",
      owner_name: "",
      phonesText: "",
      existingPhotos: [],
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
      formData.append("existing_photos", JSON.stringify(editForm.existingPhotos));

      editForm.photos.forEach((photo) => {
        formData.append("photos", photo);
      });

      await API.put(`/cars/edit/${editingCar.id}`, formData);

      await searchCars(search, { reset: true });
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
            <CarCard
              key={car.id}
              car={car}
              imageBaseUrl={imageBaseUrl}
              isDeleting={deletingId === car.id}
              onDelete={handleDeleteCar}
              onEdit={openEditModal}
              onPreview={handlePreviewImage}
            />
          ))}

          {!loading && search && cars.length === 0 && (
            <div className="py-10 text-center text-slate-500">No cars found</div>
          )}

          {!loading && cars.length > 0 && hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => searchCars(search, { reset: false })}
                disabled={loadingMore}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
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
              {editForm.existingPhotos.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Existing Images
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {editForm.existingPhotos.map((photoName) => (
                      <div key={photoName} className="relative overflow-hidden rounded-lg border border-slate-200">
                        <img
                          src={`${imageBaseUrl}/${photoName}`}
                          alt={photoName}
                          className="h-20 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm((prev) => ({
                              ...prev,
                              existingPhotos: prev.existingPhotos.filter((item) => item !== photoName),
                            }))
                          }
                          className="absolute right-1 top-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Uploading new images will be added. Use Remove on existing images to delete them.
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
