import os
from typing import List, Dict, Any, Optional

import httpx
from fastapi import HTTPException, status


async def fetch_nearby_doctors(
    lat: float,
    lng: float,
    radius_km: int = 10,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    """
    Fetch nearby doctors using the new Google Places API (Places API (New)).
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_PLACES_API_KEY is not configured on the server.",
        )

    url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "X-Goog-Api-Key": api_key,
        "Content-Type": "application/json",
        # Request only the fields we need
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.id,places.types,places.nationalPhoneNumber",
    }
    payload = {
        "includedTypes": ["doctor"],
        "maxResultCount": max_results,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius_km * 1000,  # meters
            }
        },
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to fetch providers from Google (status {resp.status_code}).",
            )
        data = resp.json()

    if "error" in data:
        message = data["error"].get("message")
        status_text = data["error"].get("status")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Places error: {status_text or 'UNKNOWN'}" + (f" ({message})" if message else ""),
        )

    places = data.get("places", []) or []
    doctors: List[Dict[str, Any]] = []
    for p in places:
        loc: Optional[Dict[str, Any]] = p.get("location")
        display_name = p.get("displayName", {})
        doctors.append(
            {
                "name": display_name.get("text"),
                "org": p.get("formattedAddress"),
                "title": "Doctor",
                "place_id": p.get("id"),
                "rating": p.get("rating"),
                "user_ratings_total": p.get("userRatingCount"),
                "email": None,
                "phone": p.get("nationalPhoneNumber"),
                "distance_km": None,  # Places API (New) nearby search does not return distance
                "lat": loc.get("latitude") if loc else None,
                "lng": loc.get("longitude") if loc else None,
            }
        )
    return doctors

