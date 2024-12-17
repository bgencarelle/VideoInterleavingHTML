// js/loadImageHttp.js

/**
 * Caches loaded Image promise objects to prevent redundant loading.
 */
const imageCache = new Map();

/**
 * Loads an image using a standard HTMLImageElement and relies on browser caching.
 * Using `img.decoding = 'async'` and no blob conversions to reduce CPU usage.
 * @param {string} path
 * @returns {Promise<HTMLImageElement|null>}
 */
export function loadImage(path) {
    // If we’ve already started loading this image, return the existing promise
    if (imageCache.has(path)) {
        return imageCache.get(path);
    }

    const imagePromise = new Promise((resolve) => {
        const img = new Image();
        // Allow async decoding
        img.decoding = 'async';
        // img.loading = 'lazy'; // Might help if supported, but not all browsers handle it for JS-created images.

        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);

        // Setting the src triggers the load. Browser caching will minimize network I/O.
        img.src = path;
    });

    imageCache.set(path, imagePromise);
    return imagePromise;
}
