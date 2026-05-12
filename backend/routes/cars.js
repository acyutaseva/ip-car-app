const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

const db = require("../database/db");
const authMiddleware = require("../middleware/authMiddleware");

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
      const query =
        req.params.query.toUpperCase();

      //
      // Partial search
      //

      db.all(
        `
        SELECT * FROM cars
        WHERE UPPER(car_number) LIKE UPPER(?)
        ORDER BY car_number ASC
      `,
        [`%${query}%`],

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
