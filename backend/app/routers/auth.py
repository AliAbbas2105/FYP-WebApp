from fastapi import APIRouter, HTTPException, Depends, status, Query, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta
import os
import uuid
from urllib.parse import unquote
from app.models.user import (
    SignupRequest,
    UserResponse,
    LoginRequest,
    TokenResponse
)
from app.database import get_database
from app.utils.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    verify_token,
    generate_verification_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    EMAIL_VERIFICATION_EXPIRY_HOURS
)
from app.utils.email import (
    send_verification_email,
    is_email_delivery_configured,
    is_auto_verify_signup,
)
from app.utils.places import fetch_nearby_doctors
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Resend trial: only one inbox can receive mail — only this address gets a verification email + login gate.
# Override with env EMAIL_VERIFICATION_WHITELIST if needed.
def _email_requires_inbox_verification(email: str) -> bool:
    target = os.getenv("EMAIL_VERIFICATION_WHITELIST", "l226703@lhr.nu.edu.pk").strip().lower()
    return email.strip().lower() == target


# Static doctor directory; in production this should be a proper provider search
NEARBY_DOCTORS = [
    {
        "name": "Dr. Aisha Rahman",
        "title": "Gastroenterologist",
        "org": "City Medical Center",
        "email": "a.rahman@example.org",
        "phone": "+1-555-201-1100",
        "distance_km": 2.4,
    },
    {
        "name": "Dr. Kenji Nakamura",
        "title": "GI Oncologist",
        "org": "Regional Cancer Institute",
        "email": "k.nakamura@example.org",
        "phone": "+1-555-201-2233",
        "distance_km": 6.1,
    },
    {
        "name": "Dr. Maria Gomez",
        "title": "Endoscopy Specialist",
        "org": "St. Mary Hospital",
        "email": "m.gomez@example.org",
        "phone": "+1-555-201-3344",
        "distance_km": 9.7,
    },
]

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current authenticated user from JWT token"""
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials. Please login again.",
        )
    
    db = get_database()
    user = await db.users.find_one({"user_id": user_id})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return UserResponse(**user)

@router.post("/signup", response_model=dict, status_code=status.HTTP_201_CREATED)
async def signup(user_data: SignupRequest, background_tasks: BackgroundTasks):
    """Sign up a new user (doctor or patient). Verification email is sent in the background so signup stays fast."""
    db = get_database()
    
    # Validate role-specific fields
    if user_data.role == "patient":
        if not user_data.age or not user_data.phone_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Patient role requires age and phone_number"
            )
    elif user_data.role == "doctor":
        if not user_data.specialization or not user_data.hospital_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doctor role requires specialization and hospital_name"
            )
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Generate user_id and doctor_id if needed
    user_id = str(uuid.uuid4())
    doctor_id = None
    if user_data.role == "doctor":
        doctor_id = str(uuid.uuid4())
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)

    use_auto_verify = is_auto_verify_signup()
    needs_inbox_verification = _email_requires_inbox_verification(user_data.email)

    if use_auto_verify:
        verification_token = None
        verification_token_expiry = None
        is_verified = True
    elif needs_inbox_verification:
        verification_token = generate_verification_token()
        verification_token_expiry = datetime.utcnow() + timedelta(
            hours=EMAIL_VERIFICATION_EXPIRY_HOURS
        )
        is_verified = False
    else:
        verification_token = None
        verification_token_expiry = None
        is_verified = True

    # Create user document
    user_doc = {
        "user_id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "role": user_data.role,
        "hashed_password": hashed_password,
        "is_verified": is_verified,
        "verification_token": verification_token,
        "verification_token_expiry": verification_token_expiry,
        "created_at": datetime.utcnow()
    }
    
    # Add role-specific fields
    if user_data.role == "patient":
        user_doc["age"] = user_data.age
        user_doc["phone_number"] = user_data.phone_number
    elif user_data.role == "doctor":
        user_doc["doctor_id"] = doctor_id
        user_doc["specialization"] = user_data.specialization
        user_doc["hospital_name"] = user_data.hospital_name
    
    # Insert user
    await db.users.insert_one(user_doc)

    if use_auto_verify:
        logger.warning(
            "AUTO_VERIFY_EMAIL is on: user %s marked verified without email — for demos only.",
            user_data.email,
        )
        return {
            "message": "Account created. Email verification is skipped (AUTO_VERIFY_EMAIL). You can log in now.",
            "user_id": user_id,
            "email": user_data.email,
            "email_delivery": "auto_verified",
            "email_sent": None,
        }

    if needs_inbox_verification:
        if not is_email_delivery_configured():
            logger.warning(
                "Signup for %s (whitelist): no Resend/SMTP; verification email not sent.",
                user_data.email,
            )
            return {
                "message": "User created successfully. Please check your email to verify your account.",
                "user_id": user_id,
                "email": user_data.email,
                "email_delivery": "disabled",
                "email_sent": False,
            }
        background_tasks.add_task(
            send_verification_email,
            user_data.email,
            verification_token,
            user_data.username,
        )
        return {
            "message": "User created successfully. A verification email is being sent — check your inbox and spam folder.",
            "user_id": user_id,
            "email": user_data.email,
            "email_delivery": "queued",
            "email_sent": None,
        }

    return {
        "message": "Account created. You can log in now (email verification is not required for this address).",
        "user_id": user_id,
        "email": user_data.email,
        "email_delivery": "verification_skipped",
        "email_sent": None,
    }

@router.post("/login", response_model=TokenResponse)
async def login(login_data: LoginRequest):
    """Login user and return JWT token"""
    db = get_database()
    
    # Find user by email
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not verify_password(login_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if email is verified
    if not user.get("is_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your email for verification link."
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["user_id"], "email": user["email"], "role": user["role"]},
        expires_delta=access_token_expires
    )
    
    # Prepare user response
    user_response = UserResponse(
        user_id=user["user_id"],
        username=user["username"],
        email=user["email"],
        role=user["role"],
        is_verified=user.get("is_verified", False),
        age=user.get("age"),
        phone_number=user.get("phone_number"),
        doctor_id=user.get("doctor_id"),
        specialization=user.get("specialization"),
        hospital_name=user.get("hospital_name")
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@router.get("/verify-email")
async def verify_email(token: str = Query(..., description="Email verification token")):
    """Verify user email with token"""
    db = get_database()

    token = unquote(token.strip())

    user = await db.users.find_one({"verification_token": token})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link.",
        )

    expiry = user.get("verification_token_expiry")
    if expiry and datetime.utcnow() > expiry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please sign up again or contact support.",
        )

    result = await db.users.update_one(
        {"verification_token": token},
        {
            "$set": {
                "is_verified": True,
                "verification_token": None,
                "verification_token_expiry": None,
            }
        },
    )
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not verify email. Please try again.",
        )

    return {"message": "Email verified successfully"}

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current authenticated user information"""
    return current_user

@router.get("/debug-token")
async def debug_token(email: str = Query(..., description="User email to check token")):
    """Debug endpoint to check stored verification token (remove in production)"""
    db = get_database()
    user = await db.users.find_one({"email": email})
    if not user:
        return {"error": "User not found"}
    
    stored_token = user.get("verification_token")
    return {
        "email": email,
        "has_token": stored_token is not None,
        "token_length": len(stored_token) if stored_token else 0,
        "token_preview": stored_token[:20] + "..." if stored_token and len(stored_token) > 20 else stored_token,
        "is_verified": user.get("is_verified", False)
    }




@router.get("/doctors/nearby")
async def get_nearby_doctors(
    current_user: UserResponse = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    lat: float | None = Query(None, description="Latitude"),
    lng: float | None = Query(None, description="Longitude"),
    radius_km: int = Query(50, ge=1, le=200),
):
    """
    Always returns a list of doctors with:
    name, title, org, email, phone, distance_km.
    """

    def ensure_fields(doc: dict) -> dict:
        """Guarantees required fields exist."""
        return {
            "name": doc.get("name", "Unknown Doctor"),
            "title": doc.get("title", "Specialist"),
            "org": doc.get("org", "Medical Center"),
            "email": doc.get("email") or "not-provided@example.com",
            "phone": doc.get("phone") or "+0000000000",
            "distance_km": float(doc.get("distance_km", 0)),
        }

    # ------------------------------
    # Try real location-based lookup
    # ------------------------------
    if lat is not None and lng is not None:
        try:
            doctors = await fetch_nearby_doctors(
                lat=lat,
                lng=lng,
                radius_km=radius_km,
                max_results=limit,
            )

            if doctors:
                return [ensure_fields(d) for d in doctors[:limit]]

        except Exception as exc:
            logger.error("Location lookup failed: %s", exc)

    # -------------------------------------
    # FALLBACK STATIC DOCTORS (Guaranteed)
    # -------------------------------------
    fallback = sorted(NEARBY_DOCTORS, key=lambda x: x["distance_km"])
    return [ensure_fields(doc) for doc in fallback[:limit]]