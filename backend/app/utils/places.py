import math
from typing import List, Dict, Any
import httpx
from fastapi import HTTPException, status

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return R * c

async def fetch_nearby_doctors(lat: float, lng: float, radius_km: int = 15, max_results: int = 20) -> List[Dict[str, Any]]:
    radius_m = radius_km * 1000
    overpass_url = "https://overpass-api.de/api/interpreter"
    
    query = f"""
    [out:json][timeout:60];
    (
      node["amenity"~"^(hospital|clinic|doctors)$"](around:{radius_m},{lat},{lng});
      way["amenity"~"^(hospital|clinic|doctors)$"](around:{radius_m},{lat},{lng});
      relation["amenity"~"^(hospital|clinic|doctors)$"](around:{radius_m},{lat},{lng});
    );
    out center;
    """

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(overpass_url, data=query, headers={"Content-Type": "text/plain"})
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"OpenStreetMap Overpass API returned {resp.status_code}",
                )

            data = resp.json()
            elements = data.get("elements", [])

            results = []
            for elem in elements:
                tags = elem.get("tags", {})
                if elem.get("type") == "node":
                    elem_lat = elem.get("lat")
                    elem_lon = elem.get("lon")
                else:
                    center = elem.get("center", {})
                    elem_lat = center.get("lat")
                    elem_lon = center.get("lon")
                if not elem_lat or not elem_lon:
                    continue

                distance = haversine_distance(lat, lng, elem_lat, elem_lon)
                if distance > radius_km:
                    continue

                name = tags.get("name") or tags.get("operator") or "Medical Facility"
                amenity = tags.get("amenity", "").lower()
                org = tags.get("operator") or tags.get("addr:housename") or tags.get("addr:street") or ""
                
                # Fetch phone and email from common OSM keys
                phone = tags.get("phone") or tags.get("contact:phone") or tags.get("phone:mobile") or None
                email = tags.get("email") or tags.get("contact:email") or None

                # Determine title
                name_lower = name.lower()
                is_gastric_related = any(k in name_lower for k in ["gastro", "gi", "gastric", "digestive", "oncology", "cancer", "gastroenterologist", "endoscopy"])
                
                if "oncology" in name_lower or "cancer" in name_lower:
                    title = "GI Oncologist" if is_gastric_related else "Oncologist"
                elif "gastro" in name_lower or "gastroenterologist" in name_lower:
                    title = "Gastroenterologist"
                elif "endoscopy" in name_lower:
                    title = "Endoscopy Specialist"
                elif "hospital" in amenity:
                    title = "Hospital" + (" (GI Department)" if is_gastric_related else "")
                elif "clinic" in amenity:
                    title = "GI Clinic" if is_gastric_related else "Clinic"
                else:
                    title = "Medical Facility"

                results.append({
                    "name": name,
                    "title": title,
                    "org": org or name,
                    "email": email,
                    "phone": phone,
                    "distance_km": round(distance, 1),
                    "lat": elem_lat,
                    "lng": elem_lon,
                    "osm_id": elem.get("id"),
                    "osm_type": elem.get("type"),
                    "gastric_related": is_gastric_related
                })

            # Sort: gastric-related first, then distance
            results.sort(key=lambda x: (not x["gastric_related"], x["distance_km"]))
            return results[:max_results]

    except httpx.TimeoutException:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="OpenStreetMap API request timed out")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Error fetching from OpenStreetMap: {str(e)}")
