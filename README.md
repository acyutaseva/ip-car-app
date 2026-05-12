# Car App

Car App is a full-stack vehicle registry system with:
- JWT-based authentication
- Admin-only user management
- Car create/search/edit/delete APIs
- Multiple image uploads per car
- React + Tailwind frontend
- Express + SQLite backend

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Axios, React Router
- Backend: Node.js, Express, SQLite, Multer, JWT, bcrypt

## Project Structure

- `frontend/` React app
- `backend/` Express API + SQLite database

## Prerequisites

- Node.js 18+
- npm

## Environment Variables

Create `backend/.env`:

```env
JWT_SECRET=your_super_secret_key
```

## Installation

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

## Running Locally

Start backend (port `5002`):

```bash
cd backend
node server.js
```

Start frontend (Vite dev server):

```bash
cd frontend
npm run dev
```

Frontend API base URL is configured in `frontend/src/services/api.js`:
- `http://localhost:5002/api`

## Authentication and Roles

- Login returns JWT token and user role.
- Token is sent as `Authorization: Bearer <token>` from frontend interceptor.
- Roles:
  - `admin`: can access user management endpoints and `/users` page
  - `user`: standard car operations, no user-management access

## Main API Endpoints

Base URL: `http://localhost:5002/api`

### Auth

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/users` (admin only)
- `DELETE /auth/users/:id` (admin only)
- `POST /auth/users/:id/change-password` (admin only)

### Cars

- `POST /cars/add` (auth)
- `GET /cars/search/:query` (auth)
- `GET /cars/all` (auth)
- `PUT /cars/edit/:id` (auth)
- `DELETE /cars/delete/:id` (auth)

## Multiple Image Upload Support

Car add/edit endpoints support multipart uploads with either field name:
- `photos` (preferred)
- `photo` (backward compatibility)

Up to 10 images can be uploaded per request.

## Notes

- SQLite DB file is stored at `backend/database/cars.db`.
- Uploaded images are served from `backend/uploads/` via `/uploads` static route.
- If this repo is public, avoid committing secrets in `.env`.
