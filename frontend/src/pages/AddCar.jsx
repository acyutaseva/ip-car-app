import { useRef, useState } from "react";
import API from "../services/api";
import Navbar from "../components/Navbar";
import Header from "../components/Header";

export default function AddCar() {
  const [carNumber, setCarNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phones, setPhones] = useState([""]);
  const [photos, setPhotos] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const appendPhotos = (newFiles) => {
    if (!newFiles.length) {
      return;
    }

    setPhotos((prev) => {
      const existingKeys = new Set(
        prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      );

      const uniqueNewFiles = newFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (existingKeys.has(key)) {
          return false;
        }
        existingKeys.add(key);
        return true;
      });

      return [...prev, ...uniqueNewFiles];
    });
  };

  const handlePhoneChange = (index, value) => {
    const updated = [...phones];
    updated[index] = value;
    setPhones(updated);
  };

  const addPhoneField = () => {
    setPhones([...phones, ""]);
  };

  const handleSubmit = async () => {
    try {
      const formData = new FormData();
      formData.append("car_number", carNumber);
      formData.append("owner_name", ownerName);
      formData.append("phone_numbers", JSON.stringify(phones));

      photos.forEach((photo) => {
        formData.append("photos", photo);
      });

      await API.post("/cars/add", formData);
      alert("Car Added");
      setCarNumber("");
      setOwnerName("");
      setPhones([""]);
      setPhotos([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }
    } catch (error) {
      alert("Error adding car");
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <Header title="Add Car" />

      <section className="surface-panel rounded-3xl p-5 md:p-7">
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Car Number"
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900"
            value={carNumber}
            onChange={(e) => setCarNumber(e.target.value.toUpperCase())}
          />

          <input
            type="text"
            placeholder="Owner Name"
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />

          {phones.map((phone, index) => (
            <input
              key={index}
              type="text"
              placeholder="Phone Number"
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900"
              value={phone}
              onChange={(e) => handlePhoneChange(index, e.target.value)}
            />
          ))}

          <button onClick={addPhoneField} className="text-sm font-semibold text-blue-700">
            + Add Another Number
          </button>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="w-full rounded-xl border border-dashed border-slate-400 bg-white p-3 text-slate-700"
              onChange={(e) => {
                appendPhotos(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="w-full rounded-xl border border-dashed border-blue-300 bg-blue-50 p-3 text-slate-700"
              onChange={(e) => {
                appendPhotos(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />

            <p className="text-xs text-slate-500">
              Use the first field to attach files, or the second field to open camera.
            </p>
          </div>

          {photos.length > 0 && (
            <p className="text-sm text-slate-600">{photos.length} image(s) selected</p>
          )}

          <button
            onClick={handleSubmit}
            className="w-full rounded-xl bg-slate-900 p-3 font-semibold text-white"
          >
            Save Car
          </button>
        </div>
      </section>
    </div>
  );
}
