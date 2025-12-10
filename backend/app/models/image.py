from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class ImageBase(BaseModel):
    image_path: str
    result: Optional[str] = None

class ImageCreate(ImageBase):
    user_id: str

class ImageInDB(ImageBase):
    image_id: str
    user_id: str
    upload_date: datetime = Field(default_factory=datetime.utcnow)
    image_path: str
    result: Optional[str] = None

class ImageResponse(BaseModel):
    image_id: str
    user_id: str
    upload_date: datetime
    image_path: str
    result: Optional[str] = None

    class Config:
        from_attributes = True

