-- =========================================
-- SAMPLE USERS
-- =========================================

INSERT INTO users (username, password)
VALUES
(
  'admin',
  '$2b$10$g7M8h8z4n8Xz6WQj3n7X8uGQh5d3D8Q7mVjQ8hQ4mG5LwV8bQzH2K'
);

-- Password: 123456


-- =========================================
-- SAMPLE CARS
-- =========================================

INSERT INTO cars
(car_number, owner_name, photo)
VALUES
('ABC123', 'John Smith', 'car1.jpg'),

('XYZ789', 'Michael Johnson', 'car2.jpg'),

('PER555', 'David Brown', 'car3.jpg'),

('WA777', 'Sarah Wilson', 'car4.jpg'),

('CAR999', 'Emma Taylor', 'car5.jpg');


-- =========================================
-- SAMPLE PHONE NUMBERS
-- =========================================

INSERT INTO phone_numbers
(car_id, phone_number)
VALUES

-- ABC123
(1, '0400000001'),
(1, '0411000001'),

-- XYZ789
(2, '0400000002'),

-- PER555
(3, '0400000003'),
(3, '0411000003'),
(3, '0422000003'),

-- WA777
(4, '0400000004'),

-- CAR999
(5, '0400000005'),
(5, '0411000005');


-- -- =========================================
-- -- VERIFY DATA
-- -- =========================================

-- SELECT * FROM users;

-- SELECT * FROM cars;

-- SELECT * FROM phone_numbers;


-- -- =========================================
-- -- JOIN QUERY TO VIEW FULL DATA
-- -- =========================================

-- SELECT
--     c.id,
--     c.car_number,
--     c.owner_name,
--     c.photo,
--     p.phone_number

-- FROM cars c

-- LEFT JOIN phone_numbers p
-- ON c.id = p.car_id

-- ORDER BY c.id;