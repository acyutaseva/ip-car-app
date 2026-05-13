const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const uploadsDir = path.resolve(__dirname, "../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = require("../database/db");
const authMiddleware = require("../middleware/authMiddleware");

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

//
// MULTER CONFIG
//

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
});
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});
const photosUpload = upload.fields([
  { name: "photos", maxCount: 10 },
  { name: "photo", maxCount: 10 },
]);

const normalizePhotoList = (photoValue) => {
  if (!photoValue) {
    return [];
  }

  if (Array.isArray(photoValue)) {
    return photoValue.filter(Boolean);
  }

  if (typeof photoValue === "string") {
    try {
      const parsed = JSON.parse(photoValue);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch (error) {
      // Single filename from older records.
    }

    return photoValue.trim() ? [photoValue] : [];
  }

  return [];
};

const getUploadedPhotoNames = (files) => {
  if (!files) {
    return [];
  }

  if (Array.isArray(files)) {
    return files.map((file) => file.filename).filter(Boolean);
  }

  return [...(files.photos || []), ...(files.photo || [])]
    .map((file) => file.filename)
    .filter(Boolean);
};

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const parseBulkImportCsv = (csvText) => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], error: "CSV must include header and at least one data row" };
  }

  const headers = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
  const carIndex = headers.indexOf("car_number");
  const ownerIndex = headers.indexOf("owner_name");
  const phonesIndex = headers.indexOf("phone_numbers");

  if (carIndex === -1 || ownerIndex === -1 || phonesIndex === -1) {
    return { rows: [], error: "CSV headers must include car_number, owner_name, phone_numbers" };
  }

  const rows = lines.slice(1).map((line, rowOffset) => {
    const cols = parseCsvLine(line);
    const car_number = (cols[carIndex] || "").toUpperCase().trim();
    const owner_name = (cols[ownerIndex] || "").trim();
    const phones = (cols[phonesIndex] || "")
      .split(/[|;]+/)
      .map((phone) => phone.trim())
      .filter(Boolean);

    return {
      rowNumber: rowOffset + 2,
      car_number,
      owner_name,
      phones,
    };
  });

  return { rows, error: null };
};

//
// ADD CAR
//

router.post(
  "/add",
  authMiddleware,
  photosUpload,
  async (req, res) => {
    try {
      const {
        car_number,
        owner_name,
        phone_numbers,
      } = req.body;

      if (!car_number || !owner_name) {
        return res.status(400).json({
          message: "Car number and owner name required",
        });
      }

      const photoList = getUploadedPhotoNames(req.files);
      const photos = photoList.length > 0 ? JSON.stringify(photoList) : null;

      const insertCar = await db.query(
        `INSERT INTO cars (car_number, owner_name, photo) VALUES ($1, $2, $3) RETURNING id`,
        [car_number.toUpperCase(), owner_name, photos]
      );
      const carId = insertCar.rows[0].id;

      let phoneArray = [];
      if (typeof phone_numbers === "string") {
        phoneArray = JSON.parse(phone_numbers);
      } else {
        phoneArray = phone_numbers;
      }

      for (const phone of phoneArray) {
        await db.query(
          `INSERT INTO phone_numbers (car_id, phone_number) VALUES ($1, $2)`,
          [carId, phone]
        );
      }

      res.json({
        message: "Car added successfully",
      });
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

router.post(
  "/bulk-import",
  authMiddleware,
  requireAdmin,
  csvUpload.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required (field: file)" });
    }

    const csvText = req.file.buffer.toString("utf8");
    const { rows, error } = parseBulkImportCsv(csvText);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const summary = {
      total: rows.length,
      inserted: 0,
      failed: 0,
      errors: [],
    };

    const insertNext = (index) => {
      if (index >= rows.length) {
        return res.json({
          message: "Bulk import complete",
          summary,
        });
      }

      const row = rows[index];

      if (!row.car_number || !row.owner_name || row.phones.length === 0) {
        summary.failed += 1;
        summary.errors.push({
          row: row.rowNumber,
          message: "Missing car_number, owner_name, or phone_numbers",
        });
        return insertNext(index + 1);
      }

      db.run(
        "INSERT INTO cars (car_number, owner_name, photo) VALUES (?, ?, ?)",
        [row.car_number, row.owner_name, null],
        function (insertErr) {
          if (insertErr) {
            summary.failed += 1;
            summary.errors.push({
              row: row.rowNumber,
              message: insertErr.message,
            });
            return insertNext(index + 1);
          }

          const carId = this.lastID;
          const stmt = db.prepare("INSERT INTO phone_numbers (car_id, phone_number) VALUES (?, ?)");

          row.phones.forEach((phone) => {
            stmt.run(carId, phone);
          });

          stmt.finalize((phoneErr) => {
            if (phoneErr) {
              summary.failed += 1;
              summary.errors.push({
                row: row.rowNumber,
                message: phoneErr.message,
              });
              return insertNext(index + 1);
            }

            summary.inserted += 1;
            return insertNext(index + 1);
          });
        }
      );
    };

    return insertNext(0);
  }
);

//
// SEARCH CAR
//

//
// SEARCH CAR (PARTIAL SEARCH)
//

router.get(
  "/search/:query",
  authMiddleware,
  async (req, res) => {
    try {
      const query = req.params.query.trim();
      const { rows: cars } = await db.query(
        `SELECT * FROM cars WHERE UPPER(car_number) LIKE UPPER($1) OR UPPER(owner_name) LIKE UPPER($2) ORDER BY car_number ASC`,
        [`%${query}%`, `%${query}%`]
      );
      if (cars.length === 0) {
        return res.json([]);
      }
      const result = [];
      for (const car of cars) {
        const { rows: phones } = await db.query(
          `SELECT phone_number FROM phone_numbers WHERE car_id = $1`,
          [car.id]
        );
        result.push({
          ...car,
          photos: normalizePhotoList(car.photo),
          phone_numbers: phones.map((p) => p.phone_number),
        });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

//
// GET ALL CARS
//

router.get(
  "/all",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const { rows: cars } = await db.query(
        `SELECT * FROM cars ORDER BY id DESC`,
        []
      );
      if (cars.length === 0) {
        return res.json([]);
      }
      const result = [];
      for (const car of cars) {
        const { rows: phones } = await db.query(
          `SELECT phone_number FROM phone_numbers WHERE car_id = $1`,
          [car.id]
        );
        result.push({
          ...car,
          photos: normalizePhotoList(car.photo),
          phone_numbers: phones.map((p) => p.phone_number),
        });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

//
// DELETE CAR
//

router.delete(
  "/delete/:id",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const carId = req.params.id;
      await db.query(`DELETE FROM phone_numbers WHERE car_id = $1`, [carId]);
      const result = await db.query(`DELETE FROM cars WHERE id = $1`, [carId]);
      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Car not found" });
      }
      res.json({ message: "Car deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

//
// EDIT CAR
//

router.put(
  "/edit/:id",
  authMiddleware,
  requireAdmin,
  photosUpload,
  async (req, res) => {
    try {
      const carId = req.params.id;
      const { car_number, owner_name, phone_numbers } = req.body;
      const { rows: carRows } = await db.query(
        `SELECT * FROM cars WHERE id = $1`,
        [carId]
      );
      const existingCar = carRows[0];
      if (!existingCar) {
        return res.status(404).json({ message: "Car not found" });
      }
      const uploadedPhotos = getUploadedPhotoNames(req.files);
      const existingPhotos = normalizePhotoList(existingCar.photo);
      const photoList = uploadedPhotos.length > 0 ? uploadedPhotos : existingPhotos;
      const photos = photoList.length > 0 ? JSON.stringify(photoList) : null;
      await db.query(
        `UPDATE cars SET car_number = $1, owner_name = $2, photo = $3 WHERE id = $4`,
        [car_number.toUpperCase(), owner_name, photos, carId]
      );
      await db.query(`DELETE FROM phone_numbers WHERE car_id = $1`, [carId]);
      let phoneArray = [];
      if (typeof phone_numbers === "string") {
        phoneArray = JSON.parse(phone_numbers);
      } else {
        phoneArray = phone_numbers;
      }
      for (const phone of phoneArray) {
        await db.query(
          `INSERT INTO phone_numbers (car_id, phone_number) VALUES ($1, $2)`,
          [carId, phone]
        );
      }
      res.json({ message: "Car updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

module.exports = router;
