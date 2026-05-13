const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const router = express.Router();
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, "../uploads"));

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
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

const getUploadedPhotoFiles = (files) => {
  if (!files) {
    return [];
  }

  if (Array.isArray(files)) {
    return files.filter(Boolean);
  }

  return [...(files.photos || []), ...(files.photo || [])].filter(Boolean);
};

const optimizeAndSavePhotos = async (files) => {
  const uploadedFiles = getUploadedPhotoFiles(files);
  const savedFileNames = [];

  for (const file of uploadedFiles) {
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const filePath = path.join(uploadsDir, fileName);

    await sharp(file.buffer)
      .rotate()
      .resize({ width: 1280, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toFile(filePath);

    savedFileNames.push(fileName);
  }

  return savedFileNames;
};

const parseJsonArray = (value) => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : null;
    } catch (error) {
      return null;
    }
  }

  return null;
};

const removePhotoFiles = async (fileNames) => {
  for (const fileName of fileNames) {
    try {
      await fs.promises.unlink(path.join(uploadsDir, fileName));
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Continue request flow even if file cleanup fails.
      }
    }
  }
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

      const photoList = await optimizeAndSavePhotos(req.files);
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

    // Refactored for PostgreSQL
    (async () => {
      for (const row of rows) {
        if (!row.car_number || !row.owner_name || row.phones.length === 0) {
          summary.failed += 1;
          summary.errors.push({
            row: row.rowNumber,
            message: "Missing car_number, owner_name, or phone_numbers",
          });
          continue;
        }

        try {
          // Insert car
          const carResult = await db.query(
            "INSERT INTO cars (car_number, owner_name, photo) VALUES ($1, $2, $3) RETURNING id",
            [row.car_number, row.owner_name, null]
          );
          const carId = carResult.rows[0].id;

          // Insert phone numbers
          for (const phone of row.phones) {
            await db.query(
              "INSERT INTO phone_numbers (car_id, phone_number) VALUES ($1, $2)",
              [carId, phone]
            );
          }

          summary.inserted += 1;
        } catch (err) {
          summary.failed += 1;
          summary.errors.push({
            row: row.rowNumber,
            message: err.message,
          });
        }
      }
      return res.json({
        message: "Bulk import complete",
        summary,
      });
    })();
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
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 100);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const { rows: cars } = await db.query(
        `SELECT
          c.id,
          c.car_number,
          c.owner_name,
          c.photo,
          STRING_AGG(p.phone_number, '||' ORDER BY p.id) AS phone_numbers_joined
        FROM cars c
        LEFT JOIN phone_numbers p ON p.car_id = c.id
        WHERE UPPER(c.car_number) LIKE UPPER($1) OR UPPER(c.owner_name) LIKE UPPER($2)
        GROUP BY c.id, c.car_number, c.owner_name, c.photo
        ORDER BY c.car_number ASC
        LIMIT $3
        OFFSET $4`,
        [`%${query}%`, `%${query}%`, limit, offset]
      );
      const result = cars.map((car) => {
        const { phone_numbers_joined, ...carData } = car;
        return {
          ...carData,
          photos: normalizePhotoList(car.photo),
          phone_numbers: phone_numbers_joined ? phone_numbers_joined.split("||") : [],
        };
      });
      res.json({
        data: result,
        pagination: {
          limit,
          offset,
          hasMore: cars.length === limit,
        },
      });
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
        `SELECT
          c.id,
          c.car_number,
          c.owner_name,
          c.photo,
          STRING_AGG(p.phone_number, '||' ORDER BY p.id) AS phone_numbers_joined
        FROM cars c
        LEFT JOIN phone_numbers p ON p.car_id = c.id
        GROUP BY c.id, c.car_number, c.owner_name, c.photo
        ORDER BY c.id DESC`,
        []
      );
      if (cars.length === 0) {
        return res.json([]);
      }
      const result = cars.map((car) => {
        const { phone_numbers_joined, ...carData } = car;
        return {
          ...carData,
          photos: normalizePhotoList(car.photo),
          phone_numbers: phone_numbers_joined ? phone_numbers_joined.split("||") : [],
        };
      });
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
  photosUpload,
  async (req, res) => {
    try {
      const carId = req.params.id;
      const { car_number, owner_name, phone_numbers, existing_photos } = req.body;
      const { rows: carRows } = await db.query(
        `SELECT * FROM cars WHERE id = $1`,
        [carId]
      );
      const existingCar = carRows[0];
      if (!existingCar) {
        return res.status(404).json({ message: "Car not found" });
      }
      const uploadedPhotos = await optimizeAndSavePhotos(req.files);
      const existingPhotos = normalizePhotoList(existingCar.photo);
      const retainedExistingPhotos = parseJsonArray(existing_photos) ?? existingPhotos;
      const safeRetainedExistingPhotos = retainedExistingPhotos.filter((photoName) =>
        existingPhotos.includes(photoName)
      );
      const removedPhotos = existingPhotos.filter(
        (photoName) => !safeRetainedExistingPhotos.includes(photoName)
      );
      const photoList = [...safeRetainedExistingPhotos, ...uploadedPhotos].filter(
        (value, index, arr) => arr.indexOf(value) === index
      );
      const photos = photoList.length > 0 ? JSON.stringify(photoList) : null;
      await db.query(
        `UPDATE cars SET car_number = $1, owner_name = $2, photo = $3 WHERE id = $4`,
        [car_number.toUpperCase(), owner_name, photos, carId]
      );
      if (removedPhotos.length > 0) {
        await removePhotoFiles(removedPhotos);
      }
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
