// js/canvas2d.js (converted from WebGL with restored alpha blending)

export const canvas = document.getElementById('displayCanvas');
const ctx = canvas.getContext('2d');

if (!ctx) {
    throw new Error("2D context not supported");
}

// Cached variables to store DPR and canvas dimensions
let cachedDpr = 1;
let cachedCssWidth = 0;
let cachedCssHeight = 0;

// Cached image aspect ratio (set by the first image loaded)
let imageAspectRatio = null;

// Scaling factors to maintain aspect ratio: [scaleX, scaleY]
let scale = [1.0, 1.0];

initializeCanvas2D(); // Initialize Canvas2D on script load

/**
 * Initializes the canvas with the correct size, scaling, and event listeners.
 * Maintains the original function name and export, but now sets up a 2D environment.
 */
export function initializeCanvas2D() {
    // Get device pixel ratio and window dimensions
    cachedDpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    cachedCssWidth = width;
    cachedCssHeight = height;

    // Set canvas dimensions based on DPR
    canvas.width = width * cachedDpr;
    canvas.height = height * cachedDpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Scale the drawing context to account for device pixel ratio
    ctx.scale(cachedDpr, cachedDpr);

    // Clear the canvas with a background color (matching original WebGL clear color)
    ctx.fillStyle = 'rgba(2, 13, 13, 1)'; // Equivalent to gl.clearColor(.01, .05, .05, 1)
    ctx.fillRect(0, 0, width, height);
    console.log('Setting clear color to rgba(2, 13, 13, 1)');

    // Initial aspect ratio scaling (will be updated after the first image is loaded)
    computeScalingFactors();

    // Handle window resize
    window.addEventListener('resize', handleResize);
}

/**
 * Computes scaling factors based on canvas and image aspect ratios to maintain aspect ratio.
 * This logic remains the same, but now applies to 2D drawing.
 */
function computeScalingFactors() {
    if (!imageAspectRatio) {
        // Default scaling if image aspect ratio is unknown
        scale = [1.0, 1.0];
        return;
    }

    const canvasAspect = cachedCssWidth / cachedCssHeight;

    if (canvasAspect > imageAspectRatio) {
        // Canvas is wider than the image
        scale[0] = imageAspectRatio / canvasAspect; // Scale X down
        scale[1] = 1.0;                            // Y remains
    } else {
        // Canvas is taller than the image
        scale[0] = 1.0;                            // X remains
        scale[1] = canvasAspect / imageAspectRatio; // Scale Y down
    }
}

/**
 * Handles window resize events by updating canvas size and recomputing scaling factors.
 */
function handleResize() {
    cachedDpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    cachedCssWidth = width;
    cachedCssHeight = height;

    // Update canvas dimensions
    canvas.width = width * cachedDpr;
    canvas.height = height * cachedDpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Reset the transformation matrix before scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Scale the drawing context to account for device pixel ratio
    ctx.scale(cachedDpr, cachedDpr);

    // Clear the canvas with the background color
    ctx.fillStyle = 'rgba(2, 13, 13, 1)'; // Matching original WebGL clear color
    ctx.fillRect(0, 0, width, height);

    // Recompute scaling factors based on new canvas size
    computeScalingFactors();
}

/**
 * Renders the foreground and background images on the canvas with alpha blending.
 * Maintains the same function signature and behavior as closely as possible,
 * but now uses 2D drawing instead of WebGL.
 *
 * @param {HTMLImageElement | HTMLCanvasElement | ImageBitmap} fgImg - The foreground image.
 * @param {HTMLImageElement | HTMLCanvasElement | ImageBitmap} bgImg - The background image.
 */
export function renderImages(fgImg, bgImg) {
    if (!fgImg || !bgImg) {
        console.warn("Foreground or background image is null");
        return;
    }

    // If image aspect ratio is not yet set, compute and cache it
    if (!imageAspectRatio) {
        imageAspectRatio = fgImg.width / fgImg.height;
        computeScalingFactors();
    }

    // Clear the canvas first with the background color
    ctx.fillStyle = 'rgba(2, 13, 13, 1)'; // Matching original WebGL clear color
    ctx.fillRect(0, 0, cachedCssWidth, cachedCssHeight);

    // Compute the drawing region so that we maintain aspect ratio
    const drawWidth = cachedCssWidth * scale[0];
    const drawHeight = cachedCssHeight * scale[1];
    const offsetX = (cachedCssWidth - drawWidth) / 2;
    const offsetY = (cachedCssHeight - drawHeight) / 2;

    // Enable alpha blending (default is 'source-over', which is equivalent to WebGL's blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA))
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0; // Ensure full opacity for images; image alpha will handle transparency

    // Draw the background image
    ctx.drawImage(bgImg, offsetX, offsetY, drawWidth, drawHeight);

    // Draw the foreground image over the background with alpha blending
    ctx.drawImage(fgImg, offsetX, offsetY, drawWidth, drawHeight);
}
