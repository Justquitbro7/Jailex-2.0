import { useEffect, useRef, useState, useCallback } from "react";
import "@/App.css";

function App() {
  // ====== CONFIG / STATE ======
  const KICK_CHANNEL = "justquitbro7";

  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const [voices, setVoices] = useState([]);
  const [kickVoiceName, setKickVoiceName] = useState("");
  const [timerVoiceName, setTimerVoiceName] = useState("");
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);

  const [timers, setTimers] = useState([]);
  const [ttsEngine, setTtsEngine] = useState("browser");

  const [speechifyApiKey, setSpeechifyApiKey] = useState("");
  const [speechifyVoiceId, setSpeechifyVoiceId] = useState("");
  const [speechifyVoices, setSpeechifyVoices] = useState([]);
  const [speechifyStatus, setSpeechifyStatus] = useState("");

  // Keywords state
  const [keywords, setKeywords] = useState([]);
  const [keywordsEnabled, setKeywordsEnabled] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywordCaseSensitive, setKeywordCaseSensitive] = useState(false);
  const [keywordError, setKeywordError] = useState("");

  // Timer form state
  const [timerMessage, setTimerMessage] = useState("");
  const [timerPreset, setTimerPreset] = useState("30");
  const [customInterval, setCustomInterval] = useState("60");
  const [timerError, setTimerError] = useState("");

  // Connections state
  const [kickUsername, setKickUsername] = useState("justquitbro7");
  const [twitchUsername, setTwitchUsername] = useState("justquitbro7");
  const [twitchToken, setTwitchToken] = useState("");
  const [twitchEnabled, setTwitchEnabled] = useState(false);
  const [twitchConnected, setTwitchConnected] = useState(false);
  const [twitchStatus, setTwitchStatus] = useState("Disconnected");

  const [activeTab, setActiveTab] = useState("tab-playback");
  const [chatLog, setChatLog] = useState([]);
  const [speakingNow, setSpeakingNow] = useState("None");
  const [readUsername, setReadUsername] = useState(true);

  const speechifyAudioRef = useRef(null);
  const queueRef = useRef(queue);
  const isSpeakingRef = useRef(isSpeaking);
  const twitchWsRef = useRef(null);

  // Update refs when state changes
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // Load browser voices
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length === 0) {
        setTimeout(loadVoices, 200);
        return;
      }
      setVoices(v);
      if (!kickVoiceName) setKickVoiceName(v[0]?.name || "");
      if (!timerVoiceName) setTimerVoiceName(v[1]?.name || v[0]?.name || "");
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, [kickVoiceName, timerVoiceName]);

  // Kick connection
  useEffect(() => {
    const connectKick = async () => {
      try {
        const res = await fetch(`https://kick.com/api/v2/channels/${KICK_CHANNEL}`);
        const data = await res.json();
        const chatroomId = data.chatroom?.id;

        const ws = new WebSocket(
          "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false"
        );

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
            const messageId = payload.id || Date.now() + "-" + Math.random();
            const text = payload.content || "";

            addMessage({
              platform: "kick",
              username,
              message: text,
              id: "kick-" + messageId
            });
          }
        };

        ws.onclose = () => setTimeout(connectKick, 5000);
      } catch (err) {
        setTimeout(connectKick, 10000);
      }
    };

    connectKick();
  }, []);

  // Check if message matches keywords
  const messageMatchesKeywords = useCallback((message) => {
    if (!keywordsEnabled || keywords.length === 0) {
      return true;
    }

    for (const kw of keywords) {
      if (kw.caseSensitive) {
        if (message.includes(kw.text)) return true;
      } else {
        if (message.toLowerCase().includes(kw.text.toLowerCase())) return true;
      }
    }

    return false;
  }, [keywordsEnabled, keywords]);

  // Add message to chat and queue
  const addMessage = useCallback((msg) => {
    setChatLog(prev => [...prev, msg]);

    // Only add to TTS queue if message matches keywords
    if (messageMatchesKeywords(msg.message)) {
      setQueue(prev => [...prev, msg]);
    }
  }, [messageMatchesKeywords]);

  // Speechify helper
  const speakWithSpeechify = async (text) => {
    if (!speechifyApiKey || !speechifyVoiceId) {
      console.warn("Speechify missing API key or voice ID");
      return false;
    }

    try {
      const res = await fetch("https://api.sws.speechify.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + speechifyApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          voice_id: speechifyVoiceId,
          text: text,
          audio_format: "mp3"
        })
      });

      if (!res.ok) {
        console.error("Speechify error:", res.status, await res.text());
        return false;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      if (speechifyAudioRef.current) {
        speechifyAudioRef.current.src = url;

        return new Promise((resolve) => {
          speechifyAudioRef.current.onended = () => {
            URL.revokeObjectURL(url);
            resolve(true);
          };
          speechifyAudioRef.current.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(false);
          };
          speechifyAudioRef.current.play().catch(() => resolve(false));
        });
      }
      return false;
    } catch (e) {
      console.error("Speechify exception:", e);
      return false;
    }
  };

  // Load Speechify voices
  const loadSpeechifyVoices = async () => {
    if (!speechifyApiKey) {
      setSpeechifyStatus("Enter your API key first.");
      return;
    }

    setSpeechifyStatus("Loading voices...");

    try {
      const res = await fetch("https://api.sws.speechify.com/v1/voices", {
        headers: {
          "Authorization": "Bearer " + speechifyApiKey
        }
      });

      if (!res.ok) {
        setSpeechifyStatus("Failed to load voices. Check API key.");
        return;
      }

      const voicesData = await res.json();
      setSpeechifyVoices(voicesData);
      setSpeechifyStatus("Voices loaded.");

      if (voicesData.length > 0) {
        setSpeechifyVoiceId(voicesData[0].voice_id);
      }
    } catch (err) {
      setSpeechifyStatus("Error loading voices.");
      console.error(err);
    }
  };

  // TTS loop
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!audioEnabled || !isPlaying || isMuted || isSpeakingRef.current || queueRef.current.length === 0) return;

      const next = queueRef.current[0];
      setQueue(prev => prev.slice(1));

      const text = readUsername
        ? `${next.username} says: ${next.message}`
        : next.message;

      setIsSpeaking(true);
      isSpeakingRef.current = true;
      setSpeakingNow(`${next.username}: ${next.message}`);

      if (ttsEngine === "speechify") {
        const ok = await speakWithSpeechify(text);
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setSpeakingNow("None");
        if (!ok) {
          // Fallback to browser TTS
          const utter = new SpeechSynthesisUtterance(text);
          utter.volume = volume;
          utter.rate = rate;
          utter.pitch = pitch;
          const voiceName = next.platform === "kick" ? kickVoiceName : timerVoiceName;
          const voice = voices.find(v => v.name === voiceName);
          if (voice) utter.voice = voice;
          utter.onend = () => {
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            setSpeakingNow("None");
          };
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        }
      } else {
        const utter = new SpeechSynthesisUtterance(text);
        utter.volume = volume;
        utter.rate = rate;
        utter.pitch = pitch;
        const voiceName = next.platform === "kick" ? kickVoiceName : timerVoiceName;
        const voice = voices.find(v => v.name === voiceName);
        if (voice) utter.voice = voice;
        utter.onend = () => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          setSpeakingNow("None");
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [audioEnabled, isPlaying, isMuted, ttsEngine, volume, rate, pitch, kickVoiceName, timerVoiceName, voices, readUsername, speechifyApiKey, speechifyVoiceId]);

  // Timer loop
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTimers(prev => {
        const updated = prev.map(t => {
          if (!t.enabled) return t;
          if (!t.lastFired || now - t.lastFired >= t.intervalMs) {
            addMessage({
              platform: "timer",
              username: "Timer",
              message: t.message,
              id: t.id + "-" + now
            });
            return { ...t, lastFired: now };
          }
          return t;
        });
        return updated;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [addMessage]);

  // Add keyword
  const addKeyword = () => {
    setKeywordError("");
    const text = keywordInput.trim();
    
    if (!text) {
      setKeywordError("Please enter a keyword.");
      return;
    }

    const duplicate = keywords.find(kw => 
      kw.text.toLowerCase() === text.toLowerCase()
    );
    if (duplicate) {
      setKeywordError("This keyword already exists.");
      return;
    }

    const kw = {
      id: "kw-" + Date.now() + "-" + Math.random(),
      text: text,
      caseSensitive: keywordCaseSensitive
    };

    setKeywords(prev => [...prev, kw]);
    setKeywordInput("");
    setKeywordCaseSensitive(false);
  };

  // Add timer
  const addTimer = () => {
    setTimerError("");

    if (timers.length >= 15) {
      setTimerError("You already have 15 timers. Delete one to add another.");
      return;
    }

    const msg = timerMessage.trim();
    if (!msg) {
      setTimerError("Please enter a timer message.");
      return;
    }

    let intervalSec;
    if (timerPreset === "custom") {
      const custom = parseInt(customInterval, 10);
      if (isNaN(custom) || custom <= 0) {
        setTimerError("Custom interval must be a positive number of seconds.");
        return;
      }
      intervalSec = custom;
    } else {
      intervalSec = parseInt(timerPreset, 10);
    }

    const timer = {
      id: "timer-" + Date.now() + "-" + Math.random(),
      message: msg,
      intervalMs: intervalSec * 1000,
      enabled: true,
      lastFired: 0
    };

    setTimers(prev => [...prev, timer]);
    setTimerMessage("");
  };

  // Enable audio
  const enableAudio = () => {
    setAudioEnabled(true);
    const starter = new SpeechSynthesisUtterance(" ");
    window.speechSynthesis.speak(starter);
    const u = new SpeechSynthesisUtterance("Audio enabled.");
    window.speechSynthesis.speak(u);
  };

  // Test TTS
  const testTts = () => {
    if (!audioEnabled) {
      alert("Enable audio first.");
      return;
    }
    addMessage({
      platform: "timer",
      username: "System",
      message: "This is a Jailex TTS test.",
      id: "test-" + Date.now()
    });
  };

  // Test Timer
  const testTimer = () => {
    addMessage({
      platform: "timer",
      username: "Timer",
      message: "Timer event fired.",
      id: "timer-" + Date.now()
    });
  };

  // Test Speechify
  const testSpeechify = async () => {
    setSpeechifyStatus("Testing Speechify voice...");
    const ok = await speakWithSpeechify("This is a Speechify test from Jailex HUD.");
    setSpeechifyStatus(ok
      ? "Speechify test played successfully."
      : "Speechify test failed. Check API key, voice ID, or console.");
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-title">Jailex HUD</div>
        <div className="sidebar-sub">Control Deck</div>

        <button 
          className={`tab-button ${activeTab === "tab-playback" ? "active" : ""}`}
          data-testid="tab-playback-btn"
          onClick={() => setActiveTab("tab-playback")}
        >
          Playback
        </button>
        <button 
          className={`tab-button ${activeTab === "tab-voices" ? "active" : ""}`}
          data-testid="tab-voices-btn"
          onClick={() => setActiveTab("tab-voices")}
        >
          Voices
        </button>
        <button 
          className={`tab-button ${activeTab === "tab-chat" ? "active" : ""}`}
          data-testid="tab-chat-btn"
          onClick={() => setActiveTab("tab-chat")}
        >
          Chat
        </button>
        <button 
          className={`tab-button ${activeTab === "tab-keywords" ? "active" : ""}`}
          data-testid="tab-keywords-btn"
          onClick={() => setActiveTab("tab-keywords")}
        >
          Keywords
        </button>
        <button 
          className={`tab-button ${activeTab === "tab-timers" ? "active" : ""}`}
          data-testid="tab-timers-btn"
          onClick={() => setActiveTab("tab-timers")}
        >
          Timers
        </button>
        <button 
          className={`tab-button ${activeTab === "tab-connections" ? "active" : ""}`}
          data-testid="tab-connections-btn"
          onClick={() => setActiveTab("tab-connections")}
        >
          Connections
        </button>

        <div className="version-tag">
          Version 1.3.0 (Keywords Filter)
        </div>
      </div>

      {/* Main Content */}
      <div className="main">
        {/* PLAYBACK TAB */}
        {activeTab === "tab-playback" && (
          <div className="panel">
            <h2>Playback Control</h2>
            <button data-testid="enable-audio-btn" onClick={enableAudio}>Enable Audio</button>
            <button data-testid="play-pause-btn" onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button data-testid="mute-btn" onClick={() => setIsMuted(!isMuted)}>
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <button data-testid="test-tts-btn" onClick={testTts}>TEST TTS</button>
            <button data-testid="test-timer-btn" onClick={testTimer}>TEST TIMER</button>

            <div style={{ marginTop: "12px" }}>
              <label>
                <input 
                  type="checkbox" 
                  checked={readUsername}
                  onChange={(e) => setReadUsername(e.target.checked)}
                  data-testid="read-username-checkbox"
                />
                Read username before message
              </label>
            </div>

            <p style={{ opacity: 0.8, fontSize: "14px", marginTop: "10px" }}>
              Queue: <span data-testid="queue-length">{queue.length}</span>
              &nbsp;|&nbsp;
              Speaking: <span data-testid="speaking-now">{speakingNow}</span>
            </p>
          </div>
        )}

        {/* VOICES TAB */}
        {activeTab === "tab-voices" && (
          <div className="panel">
            <h2>Voice Settings</h2>

            <label>TTS Engine</label>
            <select 
              value={ttsEngine}
              onChange={(e) => setTtsEngine(e.target.value)}
              data-testid="tts-engine-select"
            >
              <option value="browser">Browser TTS</option>
              <option value="speechify">Speechify External TTS</option>
            </select>
            <div className="hint">
              Browser TTS = system voices. Speechify = external API (Snoop, etc., if your plan supports it).
            </div>

            {ttsEngine === "browser" && (
              <div style={{ marginTop: "14px" }}>
                <label>Kick Voice (Browser)</label>
                <select 
                  value={kickVoiceName}
                  onChange={(e) => setKickVoiceName(e.target.value)}
                  data-testid="kick-voice-select"
                >
                  {voices.map(v => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </select>

                <label style={{ marginTop: "10px", display: "block" }}>Timer Voice (Browser)</label>
                <select 
                  value={timerVoiceName}
                  onChange={(e) => setTimerVoiceName(e.target.value)}
                  data-testid="timer-voice-select"
                >
                  {voices.map(v => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </select>

                <label style={{ marginTop: "10px", display: "block" }}>Volume</label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  data-testid="volume-slider"
                />

                <label style={{ marginTop: "10px", display: "block" }}>Rate</label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2" 
                  step="0.01" 
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  data-testid="rate-slider"
                />

                <label style={{ marginTop: "10px", display: "block" }}>Pitch</label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2" 
                  step="0.01" 
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  data-testid="pitch-slider"
                />
              </div>
            )}

            {ttsEngine === "speechify" && (
              <div style={{ marginTop: "18px" }}>
                <h3 style={{ margin: "0 0 8px 0" }}>Speechify Settings</h3>

                <label>Speechify API Key</label>
                <input 
                  type="password" 
                  placeholder="Paste your Speechify API key"
                  value={speechifyApiKey}
                  onChange={(e) => setSpeechifyApiKey(e.target.value)}
                  data-testid="speechify-api-key-input"
                />

                <label style={{ marginTop: "10px" }}>Speechify Voice ID</label>
                <input 
                  type="text" 
                  placeholder="Will update when you pick from dropdown"
                  value={speechifyVoiceId}
                  onChange={(e) => setSpeechifyVoiceId(e.target.value)}
                  data-testid="speechify-voice-id-input"
                />

                <div className="hint">
                  You must have a Speechify account and a valid voice_id. This app will call their API directly.
                </div>

                <button 
                  style={{ marginTop: "10px" }}
                  onClick={loadSpeechifyVoices}
                  data-testid="speechify-load-voices-btn"
                >
                  Load Speechify Voices
                </button>
                <select 
                  style={{ marginTop: "10px", width: "100%" }}
                  value={speechifyVoiceId}
                  onChange={(e) => setSpeechifyVoiceId(e.target.value)}
                  data-testid="speechify-voice-dropdown"
                >
                  {speechifyVoices.map(v => (
                    <option key={v.voice_id} value={v.voice_id}>{v.name || v.voice_id}</option>
                  ))}
                </select>

                <button 
                  style={{ marginTop: "10px" }}
                  onClick={testSpeechify}
                  data-testid="speechify-test-btn"
                >
                  Test Speechify Voice
                </button>
                <p style={{ fontSize: "12px", marginTop: "6px", opacity: 0.8 }} data-testid="speechify-status">
                  {speechifyStatus}
                </p>
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === "tab-chat" && (
          <div className="panel">
            <h2>Chat Feed</h2>
            <div className="chat-log" data-testid="chat-log">
              {chatLog.map((msg, idx) => (
                <div key={idx} className="chat-line">
                  <span style={{ color: msg.platform === "kick" ? "#53fc18" : "#ff7a18", fontWeight: 600 }}>
                    [{msg.platform}] {msg.username}:
                  </span> {msg.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KEYWORDS TAB */}
        {activeTab === "tab-keywords" && (
          <div className="panel">
            <h2>Keywords Filter</h2>
            <div className="hint" style={{ marginBottom: "12px" }}>
              When enabled, only messages containing at least one keyword will be read aloud.
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label>
                <input 
                  type="checkbox" 
                  checked={keywordsEnabled}
                  onChange={(e) => setKeywordsEnabled(e.target.checked)}
                  data-testid="keywords-enabled-checkbox"
                />
                Enable Keywords Filter
              </label>
              <span 
                className={`status-pill ${keywordsEnabled ? "status-on" : "status-off"}`}
                data-testid="keywords-status-pill"
              >
                {keywordsEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>

            <div>
              <label>Add Keyword</label>
              <input 
                type="text" 
                placeholder="Enter a keyword"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addKeyword()}
                data-testid="keyword-input"
              />
              
              <div className="keyword-toggle-row">
                <label>
                  <input 
                    type="checkbox" 
                    checked={keywordCaseSensitive}
                    onChange={(e) => setKeywordCaseSensitive(e.target.checked)}
                    data-testid="keyword-case-sensitive-checkbox"
                  />
                  Case-Sensitive
                </label>
              </div>

              <button 
                style={{ marginTop: "10px" }}
                onClick={addKeyword}
                data-testid="add-keyword-btn"
              >
                Add Keyword
              </button>
              <p style={{ color: "#ff7a18", fontSize: "12px", marginTop: "6px" }} data-testid="keyword-error">
                {keywordError}
              </p>
            </div>

            <div style={{ marginTop: "16px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>
                Active Keywords (<span data-testid="keywords-count">{keywords.length}</span>)
              </h3>
              <div data-testid="keywords-list">
                {keywords.length === 0 ? (
                  <p style={{ fontSize: "13px", opacity: 0.7 }} data-testid="no-keywords-msg">
                    No keywords added yet. Add keywords above to filter messages.
                  </p>
                ) : (
                  keywords.map(kw => (
                    <div key={kw.id} className="keyword-item" data-testid={`keyword-item-${kw.id}`}>
                      <div>
                        <span className="keyword-text">{kw.text}</span>
                        <div className="keyword-meta">
                          {kw.caseSensitive ? "Case-Sensitive" : "Case-Insensitive"}
                        </div>
                      </div>
                      <div className="keyword-actions">
                        <button 
                          onClick={() => {
                            setKeywords(prev => prev.map(k => 
                              k.id === kw.id ? { ...k, caseSensitive: !k.caseSensitive } : k
                            ));
                          }}
                          data-testid={`toggle-case-${kw.id}`}
                        >
                          {kw.caseSensitive ? "Make Insensitive" : "Make Sensitive"}
                        </button>
                        <button 
                          onClick={() => setKeywords(prev => prev.filter(k => k.id !== kw.id))}
                          data-testid={`delete-keyword-${kw.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TIMERS TAB */}
        {activeTab === "tab-timers" && (
          <div className="panel">
            <h2>Timers (up to 15)</h2>

            <div>
              <label>Timer Message</label>
              <input 
                type="text" 
                placeholder="What should this timer say?"
                value={timerMessage}
                onChange={(e) => setTimerMessage(e.target.value)}
                data-testid="timer-message-input"
              />

              <label style={{ marginTop: "10px", display: "block" }}>Interval Preset</label>
              <select 
                value={timerPreset}
                onChange={(e) => setTimerPreset(e.target.value)}
                data-testid="timer-preset-select"
              >
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="120">2 minutes</option>
                <option value="300">5 minutes</option>
                <option value="600">10 minutes</option>
                <option value="900">15 minutes</option>
                <option value="custom">Custom (seconds)</option>
              </select>

              {timerPreset === "custom" && (
                <div style={{ marginTop: "8px" }}>
                  <label>Custom Interval (seconds)</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={customInterval}
                    onChange={(e) => setCustomInterval(e.target.value)}
                    data-testid="custom-interval-input"
                  />
                </div>
              )}

              <button 
                style={{ marginTop: "10px" }}
                onClick={addTimer}
                data-testid="add-timer-btn"
              >
                Add Timer
              </button>
              <p style={{ color: "#ff7a18", fontSize: "12px", marginTop: "6px" }} data-testid="timer-error">
                {timerError}
              </p>
            </div>

            <div style={{ marginTop: "16px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>Active Timers</h3>
              <div data-testid="timers-list">
                {timers.map(t => (
                  <div key={t.id} className="timer-item">
                    <div><strong style={{ color: "#ff7a18" }}>{t.message}</strong></div>
                    <div className="timer-meta">
                      Every {Math.round(t.intervalMs / 1000)} seconds<br />
                      Last fired: {t.lastFired ? new Date(t.lastFired).toLocaleTimeString() : "Never"}
                    </div>
                    <div style={{ marginTop: "6px" }}>
                      <button 
                        onClick={() => {
                          setTimers(prev => prev.map(timer => 
                            timer.id === t.id ? { ...timer, enabled: !timer.enabled } : timer
                          ));
                        }}
                      >
                        {t.enabled ? "Disable" : "Enable"}
                      </button>
                      <button 
                        onClick={() => setTimers(prev => prev.filter(timer => timer.id !== t.id))}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CONNECTIONS TAB */}
        {activeTab === "tab-connections" && (
          <div className="panel">
            <h2>Connections</h2>

            <h3 style={{ marginTop: 0 }}>Kick</h3>
            <label>Kick Username</label>
            <input 
              type="text" 
              value={kickUsername}
              onChange={(e) => setKickUsername(e.target.value)}
              data-testid="kick-username-input"
            />

            <div style={{ marginTop: "8px" }}>
              <label>
                <input type="checkbox" checked disabled data-testid="kick-enable-checkbox" />
                Enable Kick (static for now)
              </label>
              <span className="status-pill status-on" data-testid="kick-status-pill">Connected (auto)</span>
            </div>

            <hr style={{ margin: "16px 0", borderColor: "rgba(255,255,255,0.2)" }} />

            <h3>Twitch</h3>
            <label>Twitch Channel Name</label>
            <input 
              type="text" 
              value={twitchUsername}
              onChange={(e) => setTwitchUsername(e.target.value)}
              placeholder="Your Twitch channel name"
              data-testid="twitch-username-input"
            />

            <label style={{ marginTop: "8px" }}>Twitch OAuth Token</label>
            <input 
              type="password" 
              placeholder="oauth:xxxxxxxxxxxxxx"
              value={twitchToken}
              onChange={(e) => setTwitchToken(e.target.value)}
              data-testid="twitch-token-input"
            />
            <div className="hint">
              Get your token at <a href="https://twitchapps.com/tmi/" target="_blank" rel="noopener noreferrer" style={{ color: "#00c8ff" }}>twitchapps.com/tmi</a>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label>
                <input 
                  type="checkbox" 
                  checked={twitchEnabled}
                  onChange={(e) => setTwitchEnabled(e.target.checked)}
                  data-testid="twitch-enable-checkbox"
                />
                Enable Twitch Chat
              </label>
              <span 
                className={`status-pill ${twitchConnected ? "status-on" : "status-off"}`}
                data-testid="twitch-status-pill"
              >
                {twitchStatus}
              </span>
            </div>

            {twitchEnabled && !twitchToken && (
              <p style={{ color: "#ff7a18", fontSize: "12px", marginTop: "6px" }}>
                Please enter your OAuth token to connect to Twitch chat.
              </p>
            )}

            <p style={{ marginTop: "12px", fontSize: "12px", opacity: 0.8 }}>
              Kick is connected automatically. For Twitch, enter your channel name and OAuth token, then enable to start receiving chat messages.
            </p>
          </div>
        )}
      </div>

      {/* Audio element for Speechify playback */}
      <audio ref={speechifyAudioRef} />
    </div>
  );
}

export default App;
