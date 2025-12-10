# Gastric Cancer Detection - Federated Learning System

A full-stack application for gastric cancer detection using Federated Learning, with FastAPI backend and React frontend.

## Project Structure

```
.
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── models/   # Pydantic models
│   │   ├── routers/  # API routes
│   │   ├── utils/    # Utilities (auth, email)
│   │   └── database.py
│   ├── requirements.txt
│   └── run.py
├── frontend/         # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── contexts/
│   │   └── services/
│   └── package.json
└── README.md
```

## Features Implemented

- ✅ User authentication (Login/Signup)
- ✅ JWT token-based authentication
- ✅ Email verification
- ✅ Role-based users (Doctor/Patient)
- ✅ MongoDB database integration
- ✅ UUID for user IDs
- ✅ Patient fields: age, phone_number
- ✅ Doctor fields: specialization, hospital_name, doctor_id

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file:
```bash
cp .env.example .env
```

5. Edit `.env` file with your settings:
   - `MONGODB_URL`: MongoDB connection string (default: `mongodb://localhost:27017`)
   - `DATABASE_NAME`: Database name (default: `gastric_cancer_fl`)
   - `SECRET_KEY`: A secret key for JWT tokens (generate a secure random string)
   - `SMTP_USER` and `SMTP_PASSWORD`: For email verification (optional - if not set, verification links will be printed to console)

6. Make sure MongoDB is running on your system.

7. Run the backend:
```bash
python run.py
```

The API will be available at `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Endpoints

### Authentication

- `POST /auth/signup` - Create a new user account
  - Body: `{ username, email, password, role, ...role-specific-fields }`
  - Returns: `{ message, user_id, email }`

- `POST /auth/login` - Login user
  - Body: `{ email, password }`
  - Returns: `{ access_token, token_type, user }`

- `GET /auth/verify-email?token=<token>` - Verify email address
  - Returns: `{ message }`

- `GET /auth/me` - Get current user info (requires authentication)
  - Headers: `Authorization: Bearer <token>`
  - Returns: `UserResponse`

## User Models

### Patient
- `user_id` (UUID, auto-generated)
- `username`
- `email`
- `password` (hashed)
- `role`: "patient"
- `age`
- `phone_number`
- `is_verified`
- `created_at`

### Doctor
- `user_id` (UUID, auto-generated)
- `doctor_id` (UUID, auto-generated)
- `username`
- `email`
- `password` (hashed)
- `role`: "doctor"
- `specialization`
- `hospital_name`
- `is_verified`
- `created_at`

## Next Steps

The following features are ready to be implemented:
- Image upload endpoint
- Image prediction endpoint
- Image history endpoint
- Dashboard pages for doctors and patients

## Notes

- Email verification: If SMTP credentials are not configured, verification links will be printed to the console for development purposes.
- JWT tokens expire after 30 minutes by default (configurable in `.env`).
- Email verification tokens expire after 24 hours (configurable in `.env`).

