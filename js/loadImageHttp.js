// js/loadImageHttp.js

/**
 * Caches loaded Image promise objects to prevent redundant loading.
 */
const imageCache = new Map();

/**
 * Loads an image using a standard HTMLImageElement and relies on browser caching.
 *
 * @param {string} path - The URL or file path of the image to load.
 * @returns {Promise<HTMLImageElement>} - A promise that resolves with the loaded image.
 * @throws {Error} - Throws an error if the image fails to load.
 */
export function loadImage(path) {
    // Return cached promise if available
    const cachedPromise = imageCache.get(path);
    if (cachedPromise) {
        return cachedPromise;
    }

    const imagePromise = new Promise((resolve, reject) => {
        const img = new Image();

        // Optional: set crossOrigin if needed
        // img.crossOrigin = 'anonymous';

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
        img.src = path;
    });

    imageCache.set(path, imagePromise);
    return imagePromise;
}
