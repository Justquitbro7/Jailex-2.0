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
    messageDuration: Optional[int] = 0  # seconds, 0 = forever
    showBadges: Optional[bool] = True
    fontSize: Optional[int] = 16
    bgOpacity: Optional[float] = 0.7

class OverlayConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    kickChannel: str = ""
    kickChatroomId: str = ""
    twitchChannel: str = ""
    twitchToken: str = ""
    maxMessages: int = 15
    messageDuration: int = 0
    showBadges: bool = True
    fontSize: int = 16
    bgOpacity: float = 0.7
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

# Static overlay endpoint with proper headers for Lightstream
from starlette.responses import HTMLResponse

@api_router.get("/stream/{config_id}", response_class=HTMLResponse)
async def serve_static_overlay(config_id: str):
    """Serve static overlay HTML with headers for Lightstream compatibility"""
    
    # Get config to verify it exists
    config = await db.overlay_configs.find_one({"id": config_id}, {"_id": 0})
    if not config:
        return HTMLResponse(
            content="<html><body style='background:transparent;color:white;'>Config not found</body></html>",
            status_code=404
        )
    
    # Get config values with defaults
    max_messages = config.get('maxMessages', 15)
    message_duration = config.get('messageDuration', 0)
    font_size = config.get('fontSize', 16)
    bg_opacity = config.get('bgOpacity', 0.7)
    show_badges = config.get('showBadges', True)
    kick_chatroom_id = config.get('kickChatroomId', '')
    twitch_channel = config.get('twitchChannel', '')
    twitch_token = config.get('twitchToken', '')
    
    # Badge HTML based on settings
    badge_html = "'<span class=\"platform-badge badge-' + platform + '\">' + (platform === 'kick' ? 'K' : 'T') + '</span>'" if show_badges else "''"
    
    html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Overlay</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ 
      background: transparent !important; 
      overflow: hidden;
      font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif;
    }}
    .chat-overlay {{
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 10px;
    }}
    .chat-messages {{
      display: flex;
      flex-direction: column;
      gap: 6px;
    }}
    .chat-message {{
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, {bg_opacity});
      border-radius: 6px;
      font-size: {font_size}px;
      transition: opacity 0.5s ease;
    }}
    .chat-message.fading {{
      opacity: 0;
    }}
    .platform-badge {{
      width: 20px;
      height: 20px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      flex-shrink: 0;
    }}
    .badge-kick {{ background: #53fc18; color: #000; }}
    .badge-twitch {{ background: #9146FF; color: #fff; }}
    .username {{ font-weight: 700; }}
    .username-kick {{ color: #53fc18; }}
    .username-twitch {{ color: #9146FF; }}
    .message-text {{ color: #ffffff; word-break: break-word; }}
  </style>
</head>
<body>
  <div class="chat-overlay">
    <div id="messages" class="chat-messages"></div>
  </div>
  <script>
    const messagesDiv = document.getElementById('messages');
    const MAX_MESSAGES = {max_messages};
    const MESSAGE_DURATION = {message_duration}; // seconds, 0 = forever
    const SHOW_BADGES = {str(show_badges).lower()};
    const config = {{"kickChatroomId": "{kick_chatroom_id}", "twitchChannel": "{twitch_channel}", "twitchToken": "{twitch_token}"}};

    function addMessage(platform, username, text) {{
      const div = document.createElement('div');
      div.className = 'chat-message';
      
      let badgeHtml = '';
      if (SHOW_BADGES) {{
        badgeHtml = '<span class="platform-badge badge-' + platform + '">' + (platform === 'kick' ? 'K' : 'T') + '</span>';
      }}
      
      div.innerHTML = badgeHtml + '<span class="username username-' + platform + '">' + username + ':</span><span class="message-text">' + text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
      messagesDiv.appendChild(div);
      
      // Remove old messages if over limit
      while (messagesDiv.children.length > MAX_MESSAGES) {{
        messagesDiv.removeChild(messagesDiv.firstChild);
      }}
      
      // Auto-remove message after duration (if set)
      if (MESSAGE_DURATION > 0) {{
        setTimeout(() => {{
          div.classList.add('fading');
          setTimeout(() => {{
            if (div.parentNode) div.parentNode.removeChild(div);
          }}, 500);
        }}, MESSAGE_DURATION * 1000);
      }}
    }}

    if (config.kickChatroomId) {{
      const kickWs = new WebSocket('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false');
      kickWs.onmessage = (e) => {{
        const msg = JSON.parse(e.data);
        if (msg.event === 'pusher:connection_established') kickWs.send(JSON.stringify({{event:'pusher:subscribe',data:{{channel:'chatrooms.'+config.kickChatroomId+'.v2'}}}}));
        if (msg.event === 'App\\\\Events\\\\ChatMessageEvent') {{ const p = JSON.parse(msg.data); addMessage('kick', p.sender?.username||'Unknown', p.content||''); }}
      }};
      kickWs.onclose = () => setTimeout(() => location.reload(), 5000);
    }}

    if (config.twitchChannel && config.twitchToken) {{
      const twitchWs = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      twitchWs.onopen = () => {{ const t = config.twitchToken.startsWith('oauth:') ? config.twitchToken : 'oauth:'+config.twitchToken; twitchWs.send('PASS '+t); twitchWs.send('NICK '+config.twitchChannel.toLowerCase()); twitchWs.send('JOIN #'+config.twitchChannel.toLowerCase()); }};
      twitchWs.onmessage = (e) => {{ if (e.data.startsWith('PING')) {{ twitchWs.send('PONG :tmi.twitch.tv'); return; }} const m = e.data.match(/:(\\w+)!\\w+@\\w+\\.tmi\\.twitch\\.tv PRIVMSG #\\w+ :(.+)/); if (m) addMessage('twitch', m[1], m[2].trim()); }};
      twitchWs.onclose = () => setTimeout(() => location.reload(), 5000);
    }}
  </script>
</body>
</html>'''
    
    response = HTMLResponse(content=html_content)
    # Set headers for Lightstream compatibility
    response.headers["Content-Security-Policy"] = "frame-ancestors *"
    response.headers["Access-Control-Allow-Origin"] = "*"
    # Explicitly remove X-Frame-Options if present
    if "X-Frame-Options" in response.headers:
        del response.headers["X-Frame-Options"]
    return response

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

# Middleware to handle frame embedding for Lightstream
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class FrameOptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # Remove X-Frame-Options to allow embedding in Lightstream
        if "x-frame-options" in response.headers:
            del response.headers["x-frame-options"]
        # Add Content-Security-Policy to allow Lightstream
        response.headers["Content-Security-Policy"] = "frame-ancestors 'self' *.golightstream.com *.lightstream.com *"
        return response

app.add_middleware(FrameOptionsMiddleware)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()