const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

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
    cb(null, "uploads/");
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
  (req, res) => {
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

      db.run(
        `
        INSERT INTO cars
        (car_number, owner_name, photo)
        VALUES (?, ?, ?)
      `,
        [
          car_number.toUpperCase(),
          owner_name,
          photos,
        ],

        function (err) {
          if (err) {
            return res.status(500).json({
              message: "Insert error",
              error: err.message,
            });
          }

          const carId = this.lastID;

          let phoneArray = [];

          if (typeof phone_numbers === "string") {
            phoneArray = JSON.parse(phone_numbers);
          } else {
            phoneArray = phone_numbers;
          }

          const stmt = db.prepare(`
            INSERT INTO phone_numbers
            (car_id, phone_number)
            VALUES (?, ?)
          `);

          phoneArray.forEach((phone) => {
            stmt.run(carId, phone);
          });

          stmt.finalize();

          res.json({
            message: "Car added successfully",
          });
        }
      );
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
  (req, res) => {
    try {
      const query = req.params.query.trim();

      //
      // Partial search
      //

      db.all(
        `
        SELECT * FROM cars
        WHERE UPPER(car_number) LIKE UPPER(?)
           OR UPPER(owner_name) LIKE UPPER(?)
        ORDER BY car_number ASC
      `,
        [`%${query}%`, `%${query}%`],

        (err, cars) => {
          if (err) {
            return res.status(500).json({
              message: "Database error",
            });
          }

          if (cars.length === 0) {
            return res.json([]);
          }

          const result = [];

          let completed = 0;

          cars.forEach((car) => {
            db.all(
              `
              SELECT phone_number
              FROM phone_numbers
              WHERE car_id = ?
            `,
              [car.id],

              (err, phones) => {
                result.push({
                  ...car,
                  photos: normalizePhotoList(car.photo),
                  phone_numbers: phones.map(
                    (p) => p.phone_number
                  ),
                });

                completed++;

                if (completed === cars.length) {
                  res.json(result);
                }
              }
            );
          });
        }
      );
    } catch (error) {
      res.status(500).json({
        message: "Server error",
      });
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
  (req, res) => {
    try {
      db.all(
        `
        SELECT * FROM cars
        ORDER BY id DESC
      `,

        [],

        (err, cars) => {
          if (err) {
            return res.status(500).json({
              message: "Database error",
            });
          }

          if (cars.length === 0) {
            return res.json([]);
          }

          const result = [];

          let completed = 0;

          cars.forEach((car) => {
            db.all(
              `
              SELECT phone_number
              FROM phone_numbers
              WHERE car_id = ?
            `,
              [car.id],

              (err, phones) => {
                result.push({
                  ...car,
                  photos: normalizePhotoList(car.photo),
                  phone_numbers: phones.map(
                    (p) => p.phone_number
                  ),
                });

                completed++;

                if (completed === cars.length) {
                  res.json(result);
                }
              }
            );
          });
        }
      );
    } catch (error) {
      res.status(500).json({
        message: "Server error",
      });
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
  (req, res) => {
    try {
      const carId = req.params.id;

      //
      // Delete phone numbers first
      //

      db.run(
        `
        DELETE FROM phone_numbers
        WHERE car_id = ?
      `,
        [carId],

        (err) => {
          if (err) {
            return res.status(500).json({
              message: "Phone delete error",
            });
          }

          //
          // Delete car
          //

          db.run(
            `
            DELETE FROM cars
            WHERE id = ?
          `,
            [carId],

            function (err) {
              if (err) {
                return res.status(500).json({
                  message: "Car delete error",
                });
              }

              if (this.changes === 0) {
                return res.status(404).json({
                  message: "Car not found",
                });
              }

              res.json({
                message: "Car deleted successfully",
              });
            }
          );
        }
      );
    } catch (error) {
      res.status(500).json({
        message: "Server error",
      });
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

  (req, res) => {
    try {
      const carId = req.params.id;

      const {
        car_number,
        owner_name,
        phone_numbers,
      } = req.body;

      //
      // Get existing car
      //

      db.get(
        `
        SELECT * FROM cars
        WHERE id = ?
      `,
        [carId],

        (err, existingCar) => {
          if (err) {
            return res.status(500).json({
              message: "Database error",
            });
          }

          if (!existingCar) {
            return res.status(404).json({
              message: "Car not found",
            });
          }

          //
          // Keep old photo if new not uploaded
          //

          const uploadedPhotos = getUploadedPhotoNames(req.files);
          const existingPhotos = normalizePhotoList(existingCar.photo);
          const photoList = uploadedPhotos.length > 0 ? uploadedPhotos : existingPhotos;
          const photos = photoList.length > 0 ? JSON.stringify(photoList) : null;

          //
          // Update car
          //

          db.run(
            `
            UPDATE cars
            SET car_number = ?,
                owner_name = ?,
                photo = ?
            WHERE id = ?
          `,
            [
              car_number.toUpperCase(),
              owner_name,
              photos,
              carId,
            ],

            (err) => {
              if (err) {
                return res.status(500).json({
                  message: "Update error",
                });
              }

              //
              // Delete old phone numbers
              //

              db.run(
                `
                DELETE FROM phone_numbers
                WHERE car_id = ?
              `,
                [carId],

                (err) => {
                  if (err) {
                    return res.status(500).json({
                      message:
                        "Phone delete error",
                    });
                  }

                  //
                  // Insert new phone numbers
                  //

                  let phoneArray = [];

                  if (
                    typeof phone_numbers ===
                    "string"
                  ) {
                    phoneArray = JSON.parse(
                      phone_numbers
                    );
                  } else {
                    phoneArray = phone_numbers;
                  }

                  const stmt = db.prepare(`
                    INSERT INTO phone_numbers
                    (car_id, phone_number)
                    VALUES (?, ?)
                  `);

                  phoneArray.forEach((phone) => {
                    stmt.run(carId, phone);
                  });

                  stmt.finalize();

                  res.json({
                    message:
                      "Car updated successfully",
                  });
                }
              );
            }
          );
        }
      );
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

module.exports = router;
