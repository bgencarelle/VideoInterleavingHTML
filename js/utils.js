// utils.js

let overlayTimeout = null;

export function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


export function calculateFPS(frameTimes = [], maxFrames = 60, elapsed = 0) {
    if (elapsed > 0) frameTimes.push(elapsed); // Add the elapsed time for this frame
    if (frameTimes.length > maxFrames) frameTimes.shift(); // Limit the frame buffer size

    const averageDeltaTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length || 0;
    const fps = averageDeltaTime > 0 ? Math.round(1000 / averageDeltaTime) : 0;

    return { fps, frameTimes };
}


export function showModeOverlay(message) {
    let overlay = document.getElementById('mode-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mode-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '10px';
        overlay.style.right = '10px';
        overlay.style.background = 'rgba(0,0,0,0.7)';
        overlay.style.color = '#fff';
        overlay.style.padding = '5px 10px';
        overlay.style.borderRadius = '4px';
        overlay.style.fontFamily = 'sans-serif';
        overlay.style.fontSize = '30px';
        overlay.style.transition = 'opacity 0.5s';
        overlay.style.opacity = '1';
        document.body.appendChild(overlay);
    }

    overlay.textContent = message;
    overlay.style.opacity = '1';

    // Clear previous timeout if any
    if (overlayTimeout) clearTimeout(overlayTimeout);

    // Set a timeout to fade out after 1 second
    overlayTimeout = setTimeout(() => {
        overlay.style.opacity = '0';
    }, 1000);
}
