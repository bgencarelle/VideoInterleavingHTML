// utils.js
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
