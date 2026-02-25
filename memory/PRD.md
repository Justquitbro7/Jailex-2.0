# Jailex HUD - TTS Control Deck for Streaming

## Original Problem Statement
User has a TTS (Text-to-Speech) app for streaming with Twitch and Kick called "Jailex HUD". They requested adding a Keywords filter feature with a dedicated tab, without changing the existing UI.

## User Requirements
1. **Keywords Filter Feature**: Only read messages containing specific keywords (when enabled)
2. **Case Sensitivity Options**: Allow both case-sensitive and case-insensitive matching per keyword
3. **No UI Changes**: Keep existing UI intact, just add new Keywords tab

## Architecture

### Frontend (React)
- **Tech Stack**: React.js, CSS
- **Key Files**: 
  - `/app/frontend/src/App.js` - Main application with all state management
  - `/app/frontend/src/App.css` - Styling matching original Jailex HUD theme

### Features
1. **Tabs**: Playback, Voices, Chat, Keywords, Timers, Connections
2. **Keywords Tab (NEW)**:
   - Enable/Disable Keywords Filter toggle
   - Add keywords with case-sensitive option per keyword
   - Toggle case sensitivity for existing keywords
   - Delete keywords
   - Status indicator pill (Enabled/Disabled)
3. **TTS Engines**: Browser TTS, Speechify External TTS
4. **Connections**: Kick (auto-connected), Twitch (UI only)
5. **Timers**: Up to 15 recurring message timers

## What's Been Implemented (Jan 2026)
- [x] Keywords Filter tab with full functionality
- [x] Case-sensitive/insensitive toggle per keyword
- [x] Only read messages containing keywords when enabled
- [x] Preserved original UI/UX design
- [x] All existing tabs working correctly

## Testing Status
- Frontend: 100% Pass
- Keywords Feature: 100% Pass
- Existing Tabs: 100% Pass

## Next Action Items
- None currently - feature complete as requested

## Future/Backlog
- P2: Twitch actual connection implementation
- P2: Keyword categories/groups
- P3: Priority keywords (read first)
- P3: Custom voice per keyword
