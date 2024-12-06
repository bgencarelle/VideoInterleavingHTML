// js/canvas.js

export const canvas = document.getElementById('displayCanvas');
export const ctx = canvas.getContext('2d');

export const offscreenCanvas = document.createElement('canvas');
export const offscreenCtx = offscreenCanvas.getContext('2d');

// Additional offscreen canvas for static background (optional)
export const backgroundCanvas = document.createElement('canvas');
export const backgroundCtx = backgroundCanvas.getContext('2d');

/**
 * Renders the foreground and background images onto the offscreen canvas,
 * then draws the offscreen canvas onto the main canvas.
 *
 * @param {HTMLImageElement} fgImg - The foreground image to draw.
 * @param {HTMLImageElement} bgImg - The background image to draw.
 * @param {boolean} shouldClear - Whether to clear the canvases before drawing.
 */
export function renderImages(fgImg, bgImg, shouldClear = true) {
    if (shouldClear) {
        // Clear the offscreen canvas
        offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    }

    // Draw the foreground and background images with aspect ratio preserved
    drawImageWithAspect(offscreenCtx, fgImg);
    drawImageWithAspect(offscreenCtx, bgImg);

    if (shouldClear) {
        // Clear the main canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Draw the offscreen canvas onto the main canvas
    ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
}

/**
 * Renders the background image onto the background offscreen canvas.
 *
 * @param {HTMLImageElement} bgImg - The background image to draw.
 */
export function renderBackground(bgImg) {
    // Clear the background canvas
    backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

    // Draw the background image with aspect ratio preserved
    drawImageWithAspect(backgroundCtx, bgImg);

    // Draw the background onto the main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(backgroundCanvas, 0, 0, canvas.width, canvas.height);
}

/**
 * Renders the foreground image onto the foreground offscreen canvas,
 * then composites it with the background canvas onto the main canvas.
 *
 * @param {HTMLImageElement} fgImg - The foreground image to draw.
 */
export function renderForeground(fgImg) {
    // Clear the offscreen canvas
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Draw the foreground image with aspect ratio preserved
    drawImageWithAspect(offscreenCtx, fgImg);

    // Composite with the background
    ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
}

/**
 * Initializes both the main and off-screen canvases to match the window size
 * and account for device pixel ratio for crisp rendering on high-DPI displays.
 */
export function initializeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Set main canvas dimensions and scale
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Set off-screen canvas dimensions and scale
    offscreenCanvas.width = width * dpr;
    offscreenCanvas.height = height * dpr;
    offscreenCanvas.style.width = `${width}px`;
    offscreenCanvas.style.height = `${height}px`;
    offscreenCtx.scale(dpr, dpr);

    // Set background canvas dimensions and scale (optional)
    backgroundCanvas.width = width * dpr;
    backgroundCanvas.height = height * dpr;
    backgroundCanvas.style.width = `${width}px`;
    backgroundCanvas.style.height = `${height}px`;
    backgroundCtx.scale(dpr, dpr);

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    offscreenCtx.imageSmoothingEnabled = true;
    backgroundCtx.imageSmoothingEnabled = true;
}

/**
 * Draws an image on the provided context while preserving its aspect ratio.
 * Optimized for performance by minimizing calculations.
 *
 * @param {CanvasRenderingContext2D} context - The canvas context to draw on.
 * @param {HTMLImageElement} img - The image to draw.
 */
export function drawImageWithAspect(context, img) {
    // Get the device pixel ratio
    const dpr = window.devicePixelRatio || 1;

    // Calculate CSS pixel dimensions
    const cssWidth = context.canvas.width / dpr;
    const cssHeight = context.canvas.height / dpr;

    const canvasAspect = cssWidth / cssHeight;
    const imgAspect = img.width / img.height;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (imgAspect > canvasAspect) {
        // Image is wider than canvas
        drawWidth = cssWidth;
        drawHeight = drawWidth / imgAspect;
        offsetX = 0;
        offsetY = (cssHeight - drawHeight) / 2;
    } else {
        // Image is taller than canvas
        drawHeight = cssHeight;
        drawWidth = drawHeight * imgAspect;
        offsetX = (cssWidth - drawWidth) / 2;
        offsetY = 0;
    }

    // Round values to integers for better performance
    drawWidth = Math.round(drawWidth);
    drawHeight = Math.round(drawHeight);
    offsetX = Math.round(offsetX);
    offsetY = Math.round(offsetY);

    // Draw the image at the calculated position with the determined size
    context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

// Initialize canvases on load
initializeCanvas();

// Optimize resizing by debouncing the resize event using requestAnimationFrame
let resizeScheduled = false;
window.addEventListener('resize', () => {
    if (!resizeScheduled) {
        resizeScheduled = true;
        requestAnimationFrame(() => {
            initializeCanvas();
            resizeScheduled = false;
        });
    }
});
