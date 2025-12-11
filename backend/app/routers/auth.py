from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta
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
from app.utils.email import send_verification_email
from app.utils.places import fetch_nearby_doctors
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

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
async def signup(user_data: SignupRequest):
    """Sign up a new user (doctor or patient)"""
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
    
    # Generate verification token
    verification_token = generate_verification_token()
    verification_token_expiry = datetime.utcnow() + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
    
    # Create user document
    user_doc = {
        "user_id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "role": user_data.role,
        "hashed_password": hashed_password,
        "is_verified": False,
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
    
    # Send verification email
    await send_verification_email(user_data.email, verification_token, user_data.username)
    
    return {
        "message": "User created successfully. Please check your email to verify your account.",
        "user_id": user_id,
        "email": user_data.email
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
    
    # Clean and normalize the token
    # FastAPI automatically URL-decodes query parameters, but we'll be explicit
    # Strip any whitespace that might have been introduced
    token = token.strip()
    print("TOKEN_FROM_FRONTEND:", repr(token))
    
    # Try to find user by verification token (exact match)
    user = await db.users.find_one({"verification_token": token})
    #need to add validation checks here, rest code is in whatsapp message
    if not user:
        print(f"User not found by exact token: {token}")
    
    # Update user to verified
    await db.users.update_one(
        {"verification_token": token},
        {
            "$set": {
                "is_verified": True,
                "verification_token": None,
                "verification_token_expiry": None
            }
        }
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
    limit: int = Query(10, ge=1, le=50),
    lat: float | None = Query(None, description="Latitude"),
    lng: float | None = Query(None, description="Longitude"),
    radius_km: int = Query(10, ge=1, le=50),
):
    """
    Return a list of nearby doctors.
    - If lat/lng provided, query Google Places.
    - Otherwise, return a static fallback list.
    """
    if lat is not None and lng is not None:
        try:
            doctors = await fetch_nearby_doctors(
                lat, lng, radius_km=radius_km, max_results=limit
            )
            if doctors:
                return doctors[:limit]
        except HTTPException as exc:
            # Log and fallback to static list on API errors (e.g., 403/400)
            logger.warning(
                "Nearby doctors API failed (status=%s): %s",
                exc.status_code,
                exc.detail,
            )
        except Exception as exc:  # noqa: BLE001
            # Log and continue with fallback
            logger.error("Nearby doctors lookup failed: %s", exc, exc_info=True)

    # Fallback static list sorted by distance
    sorted_docs = sorted(NEARBY_DOCTORS, key=lambda d: d["distance_km"])
    return sorted_docs[:limit]