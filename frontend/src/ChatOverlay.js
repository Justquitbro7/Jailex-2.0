import React, { useEffect, useState, useCallback } from "react";
import "./ChatOverlay.css";

// Platform icons as SVG
const KickIcon = () => (
  <svg viewBox="0 0 24 24" className="platform-icon kick-icon" fill="#53fc18">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

const TwitchIcon = () => (
  <svg viewBox="0 0 24 24" className="platform-icon twitch-icon" fill="#9146FF">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
  </svg>
);

const TimerIcon = () => (
  <svg viewBox="0 0 24 24" className="platform-icon timer-icon" fill="#ff7a18">
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/>
  </svg>
);

function ChatOverlay() {
  const [messages, setMessages] = useState([]);
  const [config, setConfig] = useState({
    kickChannel: "",
    twitchChannel: "",
    twitchToken: "",
    maxMessages: 15,
    showBadges: true,
    fontSize: 18,
    bgOpacity: 0.6
  });

  // Load config from URL params or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedConfig = localStorage.getItem("jailexOverlayConfig");
    
    let newConfig = { ...config };
    
    if (savedConfig) {
      try {
        newConfig = { ...newConfig, ...JSON.parse(savedConfig) };
      } catch (e) {}
    }

    // URL params override localStorage
    if (params.get("kick")) newConfig.kickChannel = params.get("kick");
    if (params.get("twitch")) newConfig.twitchChannel = params.get("twitch");
    if (params.get("token")) newConfig.twitchToken = params.get("token");
    if (params.get("max")) newConfig.maxMessages = parseInt(params.get("max")) || 15;
    if (params.get("badges")) newConfig.showBadges = params.get("badges") !== "false";
    if (params.get("size")) newConfig.fontSize = parseInt(params.get("size")) || 18;
    if (params.get("bg")) newConfig.bgOpacity = parseFloat(params.get("bg")) || 0.6;
    // chatroom ID can be passed directly to skip API call
    if (params.get("chatroomId")) newConfig.kickChatroomId = params.get("chatroomId");

    setConfig(newConfig);
  }, []);

  // Add message helper
  const addMessage = useCallback((msg) => {
    setMessages(prev => {
      const updated = [...prev, { ...msg, timestamp: Date.now() }];
      // Keep only last N messages
      if (updated.length > config.maxMessages) {
        return updated.slice(-config.maxMessages);
      }
      return updated;
    });
  }, [config.maxMessages]);

  // Connect to Kick
  useEffect(() => {
    if (!config.kickChannel) return;

    let ws = null;
    let reconnectTimeout = null;

    const connectKick = async () => {
      try {
        // Use backend proxy to bypass CORS
        const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
        const res = await fetch(`${backendUrl}/api/kick/channel/${config.kickChannel}`);
        const data = await res.json();
        const chatroomId = data.chatroom?.id;

        if (!chatroomId) {
          console.error("Could not get Kick chatroom ID");
          reconnectTimeout = setTimeout(connectKick, 10000);
          return;
        }

        ws = new WebSocket(
          "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false"
        );

        ws.onopen = () => {
          console.log("Kick connected");
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          if (msg.event === "pusher:connection_established") {
            ws.send(JSON.stringify({
              event: "pusher:subscribe",
              data: { channel: `chatrooms.${chatroomId}.v2` }
            }));
          }

          if (msg.event === "App\\Events\\ChatMessageEvent") {
            const payload = JSON.parse(msg.data);
            const username = payload.sender?.username || "Unknown";
            const text = payload.content || "";

            addMessage({
              platform: "kick",
              username,
              message: text,
              id: "kick-" + Date.now() + "-" + Math.random()
            });
          }
        };

        ws.onclose = () => {
          console.log("Kick disconnected, reconnecting...");
          reconnectTimeout = setTimeout(connectKick, 5000);
        };
      } catch (err) {
        console.error("Kick connection error:", err);
        reconnectTimeout = setTimeout(connectKick, 10000);
      }
    };

    connectKick();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [config.kickChannel, addMessage]);

  // Connect to Twitch
  useEffect(() => {
    if (!config.twitchChannel || !config.twitchToken) return;

    let ws = null;
    let reconnectTimeout = null;

    const connectTwitch = () => {
      ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

      ws.onopen = () => {
        const token = config.twitchToken.startsWith("oauth:") 
          ? config.twitchToken 
          : `oauth:${config.twitchToken}`;
        ws.send(`PASS ${token}`);
        ws.send(`NICK ${config.twitchChannel.toLowerCase()}`);
        ws.send(`JOIN #${config.twitchChannel.toLowerCase()}`);
        console.log("Twitch connected");
      };

      ws.onmessage = (event) => {
        const message = event.data;

        if (message.startsWith("PING")) {
          ws.send("PONG :tmi.twitch.tv");
          return;
        }

        const privmsgMatch = message.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG #\w+ :(.+)/);
        if (privmsgMatch) {
          const username = privmsgMatch[1];
          const text = privmsgMatch[2].trim();

          addMessage({
            platform: "twitch",
            username,
            message: text,
            id: "twitch-" + Date.now() + "-" + Math.random()
          });
        }
      };

      ws.onerror = (error) => {
        console.error("Twitch WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("Twitch disconnected, reconnecting...");
        reconnectTimeout = setTimeout(connectTwitch, 5000);
      };
    };

    connectTwitch();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [config.twitchChannel, config.twitchToken, addMessage]);

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case "kick": return <KickIcon />;
      case "twitch": return <TwitchIcon />;
      case "timer": return <TimerIcon />;
      default: return null;
    }
  };

  const getPlatformColor = (platform) => {
    switch (platform) {
      case "kick": return "#53fc18";
      case "twitch": return "#9146FF";
      case "timer": return "#ff7a18";
      default: return "#ffffff";
    }
  };

  return (
    <div 
      className="chat-overlay"
      style={{
        "--font-size": `${config.fontSize}px`,
        "--bg-opacity": config.bgOpacity
      }}
    >
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className="chat-message">
            {config.showBadges && (
              <span className="message-badge">
                {getPlatformIcon(msg.platform)}
              </span>
            )}
            <span 
              className="message-username"
              style={{ color: getPlatformColor(msg.platform) }}
            >
              {msg.username}
            </span>
            <span className="message-separator">:</span>
            <span className="message-text">{msg.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatOverlay;
