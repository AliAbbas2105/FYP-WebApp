from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from datetime import datetime
import uuid
import os
import aiofiles
from app.models.image import ImageCreate, ImageResponse
from app.database import get_database
from app.routers.auth import get_current_user
from app.models.user import UserResponse
from app.ml.inference import predict as run_model_predict
import asyncio

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=ImageResponse)
async def upload_image(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """Upload an image for analysis"""
    db = get_database()
    
    # Validate file type (only PNG, JPG, JPEG)
    allowed_types = ['image/png', 'image/jpeg', 'image/jpg']
    allowed_extensions = ['.png', '.jpg', '.jpeg']
    
    file_extension = os.path.splitext(file.filename)[1].lower() if file.filename else ''
    
    if (not file.content_type or file.content_type not in allowed_types) and file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PNG, JPG, and JPEG images are allowed"
        )
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1] if file.filename else '.jpg'
    image_id = str(uuid.uuid4())
    filename = f"{image_id}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    try:
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save image: {str(e)}"
        )
    
    # Create image document
    # Store relative path for serving
    image_doc = {
        "image_id": image_id,
        "user_id": current_user.user_id,
        "upload_date": datetime.utcnow(),
        "image_path": f"/uploads/{filename}",  # Relative path for serving
        "result": None
    }
    
    # Insert into database
    await db.images.insert_one(image_doc)
    
    return ImageResponse(**image_doc)

@router.post("/predict/{image_id}", response_model=ImageResponse)
async def predict_image(
    image_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Run prediction on an uploaded image"""
    db = get_database()
    
    # Find image
    image = await db.images.find_one({
        "image_id": image_id,
        "user_id": current_user.user_id
    })
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )
    
    # Run model inference without blocking the event loop
    result = await run_model_in_executor(image)
    
    # Update image with result
    await db.images.update_one(
        {"image_id": image_id},
        {"$set": {"result": result}}
    )
    
    # Return updated image
    updated_image = await db.images.find_one({"image_id": image_id})
    return ImageResponse(**updated_image)

def _local_image_path(image_doc):
    # Stored path is like "/uploads/<file>"; convert to filesystem path
    rel = image_doc["image_path"].lstrip("/")
    return os.path.join(os.getcwd(), rel)

async def run_model_in_executor(image):
    """Execute model inference in a thread to keep FastAPI event loop responsive."""
    loop = asyncio.get_running_loop()
    image_path = _local_image_path(image)
    return await loop.run_in_executor(None, lambda: run_model_predict(image_path))

@router.get("/history", response_model=list[ImageResponse])
async def get_image_history(
    current_user: UserResponse = Depends(get_current_user)
):
    """Get user's image upload history"""
    db = get_database()
    
    images = await db.images.find(
        {"user_id": current_user.user_id}
    ).sort("upload_date", -1).to_list(length=100)
    
    return [ImageResponse(**img) for img in images]

@router.get("/{image_id}", response_model=ImageResponse)
async def get_image(
    image_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get a specific image by ID"""
    db = get_database()
    
    image = await db.images.find_one({
        "image_id": image_id,
        "user_id": current_user.user_id
    })
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )
    
    return ImageResponse(**image)

