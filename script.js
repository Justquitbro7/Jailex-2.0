document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        document.getElementById(tab.dataset.tab).classList.add("active");
    });
});

// Default tab
document.getElementById("playback").classList.add("active");

// Chat log
function addChatMessage(platform, user, msg) {
    const log = document.getElementById("chatLog");
    const div = document.createElement("div");

    div.innerHTML = `<strong>[${platform}] ${user}:</strong> ${msg}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

// Timer
let timerInterval = null;

document.getElementById("startTimer").onclick = () => {
    let time = parseInt(document.getElementById("timerSeconds").value);
    const display = document.getElementById("timerDisplay");

    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        display.textContent = time;
        time--;
        if (time < 0) clearInterval(timerInterval);
    }, 1000);
};

document.getElementById("stopTimer").onclick = () => {
    clearInterval(timerInterval);
};

// Overlay URL generator
document.getElementById("generateOverlayUrl").onclick = () => {
    const kickId = document.getElementById("kickRoomId").value;
    const dur = document.getElementById("msgDuration").value;
    const max = document.getElementById("maxMessages").value;
    const op = document.getElementById("bgOpacity").value;
    const fs = document.getElementById("fontSize").value;
    const badges = document.getElementById("showBadges").checked ? 1 : 0;

    const url =
        `https://justquitbro7.github.io/Jailex-2.0/overlay.html` +
        `?kick=${kickId}&dur=${dur}&max=${max}&op=${op}&fs=${fs}&badges=${badges}`;

    document.getElementById("overlayUrlOutput").textContent = url;
};

// Twitch toggle
document.getElementById("enableTwitch").addEventListener("change", e => {
    const status = document.getElementById("twitchStatus");
    status.textContent = e.target.checked ? "Connected" : "Disconnected";
    status.style.color = e.target.checked ? "lime" : "red";
});
