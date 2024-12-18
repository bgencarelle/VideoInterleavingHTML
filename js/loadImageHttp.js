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
    // If the image is already being loaded, return the existing promise
    if (imageCache.has(path)) {
        return imageCache.get(path);
    }

    const imagePromise = new Promise((resolve, reject) => {
        const img = new Image();

        // Determine if the path is a cross-origin HTTP/HTTPS URL
        if (isCrossOrigin(path)) {
            img.crossOrigin = 'anonymous';
        }

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

/**
 * Determines whether the given path is a cross-origin HTTP/HTTPS URL.
 * File URLs are considered same-origin for this context.
 *
 * @param {string} path - The image path to check.
 * @returns {boolean} - True if the path is cross-origin HTTP/HTTPS, false otherwise.
 */
function isCrossOrigin(path) {
    try {
        const url = new URL(path, window.location.href);
        // Consider 'file:' protocol as same-origin for loading local files
        if (url.protocol === 'file:') {
            return false;
        }
        return url.origin !== window.location.origin;
    } catch {
        // If path is invalid, assume it's not cross-origin
        return false;
    }
}
