// js/canvas.js

export const canvas = document.getElementById('displayCanvas');
export const ctx = canvas.getContext('2d');

export const offscreenCanvas = document.createElement('canvas');
export const offscreenCtx = offscreenCanvas.getContext('2d');

/**
 * Initializes both the main and off-screen canvases to match the window size.
 */
export function initializeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Set main canvas dimensions
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    // Set off-screen canvas dimensions
    if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
    }
}

/**
 * Draws an image on the provided context while preserving its aspect ratio.
 * @param {CanvasRenderingContext2D} context - The canvas context to draw on.
 * @param {HTMLImageElement} img - The image to draw.
 */
export function drawImageWithAspect(context, img) {
    const canvasAspect = context.canvas.width / context.canvas.height;
    const imgAspect = img.width / img.height;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (imgAspect > canvasAspect) {
        // Image is wider than canvas
        drawWidth = context.canvas.width;
        drawHeight = drawWidth / imgAspect;
        offsetX = 0;
        offsetY = (context.canvas.height - drawHeight) / 2;
    } else {
        // Image is taller than canvas
        drawHeight = context.canvas.height;
        drawWidth = drawHeight * imgAspect;
        offsetX = (context.canvas.width - drawWidth) / 2;
        offsetY = 0;
    }

    context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

// Initialize canvases on load
initializeCanvas();

// Optimize resizing by debouncing the resize event
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(initializeCanvas, 100);
});
