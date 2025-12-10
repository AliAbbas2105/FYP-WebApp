# MongoDB Collections

## Database Name
`gastric_cancer_fl` (as configured in `.env`)

## Collections

### 1. `users` Collection
**Purpose**: Stores all user accounts (both doctors and patients)

**Document Structure**:
```javascript
{
  "user_id": "uuid-string",           // UUID, auto-generated
  "username": "string",
  "email": "string",
  "role": "doctor" | "patient",
  "hashed_password": "string",
  "is_verified": boolean,
  "verification_token": "string" | null,
  "verification_token_expiry": ISODate | null,
  "created_at": ISODate,
  
  // Patient-specific fields (only if role === "patient")
  "age": number,
  "phone_number": "string",
  
  // Doctor-specific fields (only if role === "doctor")
  "doctor_id": "uuid-string",          // UUID, auto-generated
  "specialization": "string",
  "hospital_name": "string"
}
```

**Indexes** (recommended):
- `{ "email": 1 }` - unique index
- `{ "username": 1 }` - unique index
- `{ "user_id": 1 }` - unique index
- `{ "verification_token": 1 }` - for email verification lookups

**Usage in Code**:
- `db.users.find_one({"email": email})`
- `db.users.find_one({"user_id": user_id})`
- `db.users.insert_one(user_doc)`
- `db.users.update_one(...)`

---

### 2. `images` Collection
**Purpose**: Stores uploaded images and their prediction results

**Document Structure**:
```javascript
{
  "image_id": "uuid-string",          // UUID, auto-generated
  "user_id": "uuid-string",            // References users.user_id
  "upload_date": ISODate,
  "image_path": "string",              // Path to stored image file
  "result": "string" | null             // Prediction result (e.g., "cancerous", "non-cancerous")
}
```

**Indexes** (recommended):
- `{ "image_id": 1 }` - unique index
- `{ "user_id": 1 }` - for user's image history queries
- `{ "upload_date": -1 }` - for sorting by upload date

**Usage in Code** (when implemented):
- `db.images.insert_one(image_doc)`
- `db.images.find({"user_id": user_id})`
- `db.images.find_one({"image_id": image_id})`

---

## Notes

1. **Single Collection for Users**: Both doctors and patients are stored in the same `users` collection, differentiated by the `role` field. This simplifies queries and allows for easy role-based filtering.

2. **UUID vs ObjectId**: The code uses UUID strings (`user_id`, `doctor_id`, `image_id`) instead of MongoDB's native ObjectId. This provides:
   - Better compatibility with external systems
   - Easier to work with in APIs
   - No need to convert between ObjectId and strings

3. **Auto-creation**: Collections are automatically created when the first document is inserted. No need to manually create them.

4. **Database Connection**: The database connection is managed in `app/database.py` and uses Motor (async MongoDB driver).

