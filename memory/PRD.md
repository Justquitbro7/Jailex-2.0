# Jailex HUD - TTS Control Deck for Streaming

## Original Problem Statement
User has a TTS (Text-to-Speech) app for streaming with Twitch and Kick called "Jailex HUD". Requested features:
1. Keywords filter - Only read messages containing specific keywords
2. Twitch chat integration - Actually connect to Twitch IRC
3. Chat Overlay - Browser source for OBS similar to Botrix

## User Requirements
1. **Keywords Filter**: Only read messages containing specific keywords (when enabled), with case-sensitive/insensitive per keyword
2. **Twitch Integration**: Real IRC connection to Twitch chat
3. **Chat Overlay**: Separate `/overlay` URL for OBS browser source with platform badges

## Architecture

### Frontend (React)
- **Tech Stack**: React.js, CSS, React Router
- **Key Files**: 
  - `/app/frontend/src/App.js` - Main HUD application
  - `/app/frontend/src/ChatOverlay.js` - OBS overlay component
  - `/app/frontend/src/ChatOverlay.css` - Overlay styling
  - `/app/frontend/src/index.js` - Router setup

### Features
1. **Tabs**: Playback, Voices, Chat, Keywords, Timers, Overlay, Connections
2. **Keywords Tab**: Enable/disable filter, add/delete keywords, case-sensitivity per keyword
3. **Twitch Connection**: Real IRC via WebSocket to irc-ws.chat.twitch.tv
4. **Chat Overlay** (`/overlay`): 
   - Transparent background for OBS
   - Platform badges (Kick green, Twitch purple)
   - URL parameters: kick, twitch, token, max, badges, size, bg
5. **TTS Engines**: Browser TTS, Speechify External TTS
6. **Timers**: Up to 15 recurring message timers

## What's Been Implemented (Jan 2026)
- [x] Keywords Filter tab with case-sensitivity options
- [x] Twitch IRC chat connection (real connection, not UI only)
- [x] Chat Overlay at /overlay for OBS browser source
- [x] Overlay tab with URL generator and OBS setup instructions
- [x] Platform badges/icons in overlay
- [x] All existing tabs preserved

## Testing Status
- Frontend: 100% Pass
- Overlay Feature: 100% Pass
- Twitch Integration: 100% Pass
- Keywords Feature: 100% Pass

## How to Use Chat Overlay
1. Go to Overlay tab in Jailex HUD
2. Copy the generated URL
3. In OBS: Sources → + → Browser → Paste URL
4. Set width 400, height 600 (adjust as needed)

## URL Parameters for Overlay
- `kick=username` - Kick channel
- `twitch=username` - Twitch channel
- `token=oauth:xxx` - Twitch OAuth token
- `max=15` - Max messages
- `badges=true/false` - Show platform badges
- `size=18` - Font size (px)
- `bg=0.6` - Background opacity (0-1)

## Next Action Items
- None currently - all requested features complete

## Future/Backlog
- P2: Custom chat colors per user
- P2: Chat message filtering (spam, links)
- P3: Animated message entrances (optional)
- P3: Custom fonts in overlay
