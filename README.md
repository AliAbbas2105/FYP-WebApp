# Gastric Cancer Analysis Web App

Full-stack project with:
- **Frontend:** React + Vite
- **Backend:** FastAPI + MongoDB
- **Features:** auth, email verification, image analysis flow, result report PDF, nearby specialists lookup

## Repository Structure

```text
website frontend/
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   ├── package.json
│   └── .env.example
├── app.js              # static/demo app (separate from React frontend)
├── index.html          # static/demo app entry
└── README.md
```

## Features

- User signup/login with JWT
- Role-based user model (doctor/patient)
- Email verification flow
- Image upload and prediction flow
- Result page with recommendations
- Lab report PDF download (fixed style)
- Nearby specialists (Geoapify + fallback)

## Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB (local or cloud)
- SMTP credentials (for email verification)
- Geoapify API key (for nearby specialists)

## Local Setup

### 1) Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGODB_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/gastric_cancer_fl?retryWrites=true&w=majority
DATABASE_NAME=gastric_cancer_fl
SECRET_KEY=replace_with_random_secret

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Comma-separated allowed frontend URLs for CORS
FRONTEND_URL=http://localhost:5173
```

Run backend:

```bash
python run.py
```

Backend URLs:
- API base: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`

### 2) Frontend (React)

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_GEOAPIFY_API_KEY=your_geoapify_api_key_here
```

Run frontend:

```bash
npm run dev
```

Frontend URL: shown by Vite (usually `http://localhost:5173`)

## Deployment (Free)

- **Frontend:** Vercel (root: `frontend`)
- **Backend:** Render (root: `backend`)

Required production env vars:

### Render (backend)
- `MONGODB_URL`
- `DATABASE_NAME`
- `SECRET_KEY`
- `FRONTEND_URL=https://your-frontend-domain.vercel.app`

**Email on Render Free:** outbound **SMTP (ports 25 / 465 / 587) is often blocked**, so Gmail SMTP may fail with `Network is unreachable`. Pick one approach:

1. **Resend (HTTPS API, works on free Render):** set `RESEND_API_KEY` and `RESEND_FROM` (verified domain or Resend test sender per [resend.com](https://resend.com) docs).

2. **Skip email verification (demos / FYP only):** set **`AUTO_VERIFY_EMAIL=true`**. New users are **verified immediately** at signup; no mail is sent. **Do not use for production** (anyone can register and use the app with any email).

3. **SMTP:** use `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` when the host allows it (e.g. local dev or a paid host that does not block SMTP).

Sending order when mail is used: **Resend → SMTP**.

Recommended Render settings:
- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Vercel (frontend)
- `VITE_API_BASE_URL=https://your-backend-domain.onrender.com`
- `VITE_GEOAPIFY_API_KEY=...`

Recommended Vercel settings:
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

## Important Git Notes

- Never commit real `.env` files.
- Keep only `.env.example` files in GitHub.
- `.gitignore` is configured to ignore runtime/build/secret files.

## Troubleshooting

- **CORS errors:** check `FRONTEND_URL` in backend env.
- **Signup preflight 400:** ensure backend includes current frontend domain/port.
- **Nearby doctors error:** verify `VITE_GEOAPIFY_API_KEY` and API category compatibility.
- **Website/contact missing:** some providers do not publish full contact data.
- **Verification email / `[Errno 101] Network is unreachable` on Render:** use **`RESEND_API_KEY`**, or **`AUTO_VERIFY_EMAIL=true`** for demo-only signup without mail, or upgrade to a plan that allows SMTP.

