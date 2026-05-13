import { useEffect, useMemo, useState } from "react";
import API, { UPLOADS_BASE_URL } from "../services/api";
import Navbar from "../components/Navbar";
import Header from "../components/Header";

const PAGE_SIZE = 8;

const parsePhoneInput = (value) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function AdminCars() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
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

  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const imageBaseUrl = UPLOADS_BASE_URL;

  const totalPages = Math.max(1, Math.ceil(cars.length / PAGE_SIZE));

  const paginatedCars = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return cars.slice(start, start + PAGE_SIZE);
  }, [cars, page]);

  useEffect(() => {
    loadCars();
  }, []);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const loadCars = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/cars/all");
      setCars(res.data || []);
    } catch (loadError) {
      setError("Failed to load cars");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (carId, carNumber) => {
    const confirmed = window.confirm(`Delete car ${carNumber}?`);

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(carId);
      await API.delete(`/cars/delete/${carId}`);
      setCars((prev) => prev.filter((car) => car.id !== carId));
    } catch (deleteError) {
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
      existingPhotos: car.photos || [],
      photos: [],
    });
  };

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

      await loadCars();
      closeEditModal();
    } catch (saveError) {
      alert("Failed to update car");
      setSaving(false);
    }
  };

  const handleImportCars = async () => {
    if (!importFile) {
      alert("Select a CSV file first");
      return;
    }

    try {
      setImporting(true);
      setImportSummary(null);

      const formData = new FormData();
      formData.append("file", importFile);

      const res = await API.post("/cars/bulk-import", formData);
      setImportSummary(res.data.summary || null);
      setImportFile(null);
      await loadCars();
    } catch (importError) {
      const message = importError?.response?.data?.message || "Import failed";
      alert(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <Header title="All Cars (Admin)" />

      <section className="surface-panel mb-5 rounded-3xl p-5 md:p-6">
        <h2 className="mb-3 text-xl font-bold text-slate-900">Import Cars (One-time CSV)</h2>
        <p className="mb-2 text-sm text-slate-600">
          CSV headers required: <code>car_number,owner_name,phone_numbers</code>
        </p>
        <p className="mb-4 text-xs text-slate-500">
          For multiple phone numbers in one row, separate using <code>|</code> or <code>;</code>
        </p>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="file"
            accept=".csv,text/csv"
            className="w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-700 md:max-w-sm"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          />
          <button
            onClick={handleImportCars}
            disabled={importing}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {importing ? "Importing..." : "Import CSV"}
          </button>
        </div>

        {importSummary && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-800">
              Imported: {importSummary.inserted} / {importSummary.total}
            </p>
            <p className="text-slate-600">Failed: {importSummary.failed}</p>

            {importSummary.errors?.length > 0 && (
              <div className="mt-2 max-h-40 overflow-auto rounded-lg bg-white p-2">
                {importSummary.errors.map((err, idx) => (
                  <p key={`${err.row}-${idx}`} className="text-xs text-rose-600">
                    Row {err.row}: {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="surface-panel rounded-3xl p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Cars</h2>
          <button
            onClick={loadCars}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Refresh
          </button>
        </div>

        {loading && <p className="text-slate-600">Loading cars...</p>}
        {error && <p className="text-rose-600">{error}</p>}

        {!loading && !error && cars.length === 0 && (
          <p className="text-slate-600">No cars found.</p>
        )}

        {!loading && !error && cars.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-sm text-slate-500">
                    <th className="px-2 py-2">Car #</th>
                    <th className="px-2 py-2">Owner</th>
                    <th className="px-2 py-2">Phones</th>
                    <th className="px-2 py-2">Images</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCars.map((car) => (
                    <tr key={car.id} className="border-b border-slate-100 align-top">
                      <td className="px-2 py-3 font-semibold text-slate-900">{car.car_number}</td>
                      <td className="px-2 py-3 text-slate-700">{car.owner_name}</td>
                      <td className="px-2 py-3 text-slate-700">{(car.phone_numbers || []).join(", ")}</td>
                      <td className="px-2 py-3 text-slate-700">{(car.photos || []).length}</td>
                      <td className="px-2 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(car)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(car.id, car.car_number)}
                            disabled={deletingId === car.id}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {deletingId === car.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
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
                placeholder="Phone Numbers (comma or new line separated)"
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
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
