from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime
from bson import ObjectId
from typing import Union

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

# User schemas
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    role: Literal["doctor", "patient"]

class PatientCreate(UserBase):
    password: str = Field(..., min_length=8)
    age: int = Field(..., gt=0, le=150)
    phone_number: str = Field(..., min_length=10, max_length=15)

class DoctorCreate(UserBase):
    password: str = Field(..., min_length=8)
    specialization: str = Field(..., min_length=2, max_length=100)
    hospital_name: str = Field(..., min_length=2, max_length=200)

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: Literal["doctor", "patient"]
    # Patient fields (optional)
    age: Optional[int] = Field(None, gt=0, le=150)
    phone_number: Optional[str] = Field(None, min_length=10, max_length=15)
    # Doctor fields (optional)
    specialization: Optional[str] = Field(None, min_length=2, max_length=100)
    hospital_name: Optional[str] = Field(None, min_length=2, max_length=200)

class UserInDB(BaseModel):
    user_id: str
    username: str
    email: str
    role: str
    hashed_password: str
    is_verified: bool = False
    verification_token: Optional[str] = None
    verification_token_expiry: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # Patient specific fields
    age: Optional[int] = None
    phone_number: Optional[str] = None
    # Doctor specific fields
    doctor_id: Optional[str] = None
    specialization: Optional[str] = None
    hospital_name: Optional[str] = None

class UserResponse(BaseModel):
    user_id: str
    username: str
    email: str
    role: str
    is_verified: bool
    # Patient fields
    age: Optional[int] = None
    phone_number: Optional[str] = None
    # Doctor fields
    doctor_id: Optional[str] = None
    specialization: Optional[str] = None
    hospital_name: Optional[str] = None

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

