// js/canvas.js

export const canvas = document.getElementById('displayCanvas');
export const ctx = canvas.getContext('2d');

export const offscreenCanvas = document.createElement('canvas');
export const offscreenCtx = offscreenCanvas.getContext('2d');

// Cached variables to store DPR and drawing parameters
let cachedDpr = 1;
let cachedCssWidth = 0;
let cachedCssHeight = 0;
let cachedCanvasAspect = 1;
let cachedDrawParams = null;

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

    // If drawing parameters are not cached, compute and cache them
    if (!cachedDrawParams) {
        cachedDrawParams = computeDrawParameters(offscreenCtx, fgImg);
    }

    const { offsetX, offsetY, drawWidth, drawHeight } = cachedDrawParams;

    // Draw the foreground and background images using cached parameters
    offscreenCtx.drawImage(fgImg, offsetX, offsetY, drawWidth, drawHeight);
    offscreenCtx.drawImage(bgImg, offsetX, offsetY, drawWidth, drawHeight);

    if (shouldClear) {
        // Clear the main canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Draw the offscreen canvas onto the main canvas
    ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
}

/**
 * Initializes both the main and off-screen canvases to match the window size
 * and account for device pixel ratio for crisp rendering on high-DPI displays.
 */
export function initializeCanvas() {
    cachedDpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    cachedCssWidth = width;
    cachedCssHeight = height;
    cachedCanvasAspect = width / height;
    cachedDrawParams = null; // Reset cached draw parameters on resize

    // Set main canvas dimensions and scale
    canvas.width = width * cachedDpr;
    canvas.height = height * cachedDpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(cachedDpr, cachedDpr);

    // Set off-screen canvas dimensions and scale
    offscreenCanvas.width = width * cachedDpr;
    offscreenCanvas.height = height * cachedDpr;
    offscreenCanvas.style.width = `${width}px`;
    offscreenCanvas.style.height = `${height}px`;
    offscreenCtx.scale(cachedDpr, cachedDpr);

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = false;
    offscreenCtx.imageSmoothingEnabled = false;
    // backgroundCtx.imageSmoothingEnabled = true;
}

/**
 * Computes and returns the drawing parameters for an image while preserving its aspect ratio.
 *
 * @param {CanvasRenderingContext2D} context - The canvas context to use for calculations.
 * @param {HTMLImageElement} img - The image for which to compute draw parameters.
 * @returns {Object} An object containing drawWidth, drawHeight, offsetX, and offsetY.
 */
function computeDrawParameters(context, img) {
    const canvasAspect = cachedCanvasAspect;
    const imgAspect = img.width / img.height;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (imgAspect > canvasAspect) {
        // Image is wider than canvas
        drawWidth = cachedCssWidth;
        drawHeight = drawWidth / imgAspect;
        offsetX = 0;
        offsetY = (cachedCssHeight - drawHeight) / 2;
    } else {
        // Image is taller than canvas
        drawHeight = cachedCssHeight;
        drawWidth = drawHeight * imgAspect;
        offsetX = (cachedCssWidth - drawWidth) / 2;
        offsetY = 0;
    }

    // Round values to integers for better performance
    drawWidth = Math.round(drawWidth);
    drawHeight = Math.round(drawHeight);
    offsetX = Math.round(offsetX);
    offsetY = Math.round(offsetY);

    return { drawWidth, drawHeight, offsetX, offsetY };
}

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
