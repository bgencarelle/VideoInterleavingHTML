// js/loadImageHttp.js

/**
 * Caches loaded Image promise objects to prevent redundant loading.
 */
const imageCache = new Map();

/**
 * Loads an image using a standard HTMLImageElement and relies on browser caching.
 * Utilizes async decoding and handles CORS and file protocols.
 *
 * @param {string} path - The URL or file path of the image to load.
 * @returns {Promise<HTMLImageElement>} - A promise that resolves with the loaded image.
 * @throws {Error} - Throws an error if the image fails to load.
 */
export function loadImage(path) {
    // Attempt to retrieve the existing promise directly
    const cachedPromise = imageCache.get(path);
    if (cachedPromise) {
        return cachedPromise;
    }

    const imagePromise = new Promise((resolve, reject) => {
        const img = new Image();

        // Allow async decoding
        img.decoding = 'async';

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${path}`));

        // Setting the src triggers the load. Browser caching will minimize network I/O.
        img.src = path;
    });

    imageCache.set(path, imagePromise);
    return imagePromise;
}
