from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx
import secrets
import string


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Overlay Config Models
class OverlayConfigCreate(BaseModel):
    kickChannel: Optional[str] = ""
    kickChatroomId: Optional[str] = ""
    twitchChannel: Optional[str] = ""
    twitchToken: Optional[str] = ""
    maxMessages: Optional[int] = 15
    showBadges: Optional[bool] = True
    fontSize: Optional[int] = 18
    bgOpacity: Optional[float] = 0.6

class OverlayConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    kickChannel: str = ""
    kickChatroomId: str = ""
    twitchChannel: str = ""
    twitchToken: str = ""
    maxMessages: int = 15
    showBadges: bool = True
    fontSize: int = 18
    bgOpacity: float = 0.6
    createdAt: str = ""

def generate_short_id(length=6):
    """Generate a short alphanumeric ID"""
    chars = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

# Overlay Config endpoints
@api_router.post("/overlay/config")
async def create_overlay_config(config: OverlayConfigCreate):
    """Save overlay config and return a short ID"""
    short_id = generate_short_id()
    
    # Make sure ID is unique
    while await db.overlay_configs.find_one({"id": short_id}):
        short_id = generate_short_id()
    
    doc = {
        "id": short_id,
        **config.model_dump(),
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.overlay_configs.insert_one(doc)
    return {"id": short_id, "message": "Config saved"}

@api_router.get("/overlay/config/{config_id}")
async def get_overlay_config(config_id: str):
    """Get overlay config by short ID"""
    config = await db.overlay_configs.find_one({"id": config_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config

# Kick API Proxy to bypass CORS
@api_router.get("/kick/channel/{channel_name}")
async def get_kick_channel(channel_name: str):
    """Proxy endpoint for Kick channel API to bypass CORS restrictions"""
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"https://kick.com/api/v2/channels/{channel_name}",
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer": "https://kick.com/",
                    "Origin": "https://kick.com"
                },
                timeout=10.0,
                follow_redirects=True
            )
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Kick API returned status {response.status_code}: {response.text}")
                return {"error": f"Kick API returned status {response.status_code}"}
    except Exception as e:
        logger.error(f"Kick API proxy error: {e}")
        return {"error": str(e)}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()