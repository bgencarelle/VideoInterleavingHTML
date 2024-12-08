// utils.js


let overlayTimeout = null;

export function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
// utils.js

export function drawOverlayText(
  ctx,
  canvas,
  overallIndex = 0,
  indexController = { direction: 1 },
  fgImg = { src: '' },
  bgImg = { src: '' },
  fps = NaN,
  imageCache = { sizeCurrent: () => 0 }
){    const fgName = fgImg.src.split('/').pop();
    const bgName = bgImg.src.split('/').pop();

    ctx.font = '16px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'right';

    // Basic overlay information
    ctx.fillText(`Index: ${overallIndex}, Direction: ${indexController.direction === 1 ? 'Forward' : 'Backward'}`, canvas.width - 10, canvas.height - 130);
    ctx.fillText(`Foreground: ${fgName}`, canvas.width - 10, canvas.height - 110);
    ctx.fillText(`Floatground: ${bgName}`, canvas.width - 10, canvas.height - 90);
    ctx.fillText(`FPS: ${fps}`, canvas.width - 10, canvas.height - 70);
    ctx.fillText(`Cache Size: ${imageCache.sizeCurrent()}`, canvas.width - 10, canvas.height - 50);

    // Expected buffer range
}
// utils.js

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
