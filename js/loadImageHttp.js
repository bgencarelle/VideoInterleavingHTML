// js/loadImageHttp.js

/**
 * Caches loaded Image elements to prevent redundant loading.
 */
const imageCache = new Map();

/**
 * Loads an image using an HTMLImageElement.
 * Optimized for performance without retry logic.
 * @param {string} path - The HTTP path to the image.
 * @returns {Promise<HTMLImageElement|null>} A promise resolving to the loaded Image or null if failed.
 */
export function loadImage(path) {
    // Return cached Image if available
    if (imageCache.has(path)) {
        return imageCache.get(path);
    }

    // Create a new Promise for image loading
    const imagePromise = new Promise((resolve) => {
        const img = new Image();

        // Optional: Set crossOrigin if needed
        // img.crossOrigin = 'anonymous';

        img.onload = () => {
            // Image loaded successfully
            resolve(img);
        };

        img.onerror = (error) => {
            // Handle loading errors
            console.error(`Failed to load image: ${path}`, error);
            resolve(null); // Resolve with null to indicate failure
        };

        // Start loading the image
        img.src = path;
    });

    // Cache the Promise to prevent duplicate loads
    imageCache.set(path, imagePromise);

    return imagePromise;
}
