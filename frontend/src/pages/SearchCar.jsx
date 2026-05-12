import { useEffect, useState } from "react";
import API from "../services/api";
import Navbar from "../components/Navbar";
import Header from "../components/Header";

export default function SearchCar() {
  const [search, setSearch] = useState("");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

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

  return (
    <div className="app-shell">
      <Navbar />
      <Header title="Search Car" />

      <section className="surface-panel rounded-3xl p-5 md:p-6">
        <input
          type="text"
          placeholder="Search Car Number..."
          className="mb-4 w-full rounded-2xl border border-slate-300 bg-white p-4 text-lg text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
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
              {(car.photos || []).length > 0 ? (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {car.photos.map((photoName, photoIndex) => (
                    <img
                      key={`${car.id}-${photoName}-${photoIndex}`}
                      src={`${imageBaseUrl}/${photoName}`}
                      alt={`${car.car_number}-${photoIndex + 1}`}
                      className="h-40 w-full rounded-2xl object-cover md:h-48"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="mb-4 flex h-48 w-full items-center justify-center rounded-2xl bg-slate-200 text-slate-500">
                  No Image
                </div>
              )}

              <h2 className="mb-1 text-2xl font-bold text-slate-900">{car.car_number}</h2>
              <p className="mb-4 text-slate-600">{car.owner_name}</p>

              <div className="space-y-3">
                {car.phone_numbers.map((phone, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <span className="font-medium text-slate-900">{phone}</span>

                    <div className="flex gap-2">
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
    </div>
  );
}
  const imageBaseUrl = "http://localhost:5002/uploads";
