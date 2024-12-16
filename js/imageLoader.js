// js/loadImageBitmap.js

/**
 * Caches loaded ImageBitmap instances to prevent redundant loading and decoding.
 */
const imageCache = new Map();

/**
 * Loads an image as an ImageBitmap using the Fetch API.
 * Optimized for performance without retry logic.
 * @param {string} path - The path to the image (can be a file:// URL or a Data URL).
 * @returns {Promise<ImageBitmap|null>} A promise resolving to an ImageBitmap or null if failed.
 */
export async function loadImage(path) {
    // Return cached ImageBitmap if available
    if (imageCache.has(path)) {
        return imageCache.get(path);
    }

    try {
        const response = await fetch(path, { mode: 'cors' }); // Adjust mode as needed
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);
        imageCache.set(path, imageBitmap); // Cache the ImageBitmap
        return imageBitmap;
    } catch (error) {
        console.error(`Failed to load ImageBitmap: ${path}`, error);
        return null;
    }
}
