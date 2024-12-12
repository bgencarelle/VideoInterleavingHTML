// js/imageLoader.js

/**
 * Loads an image as an HTMLImageElement with retry capability.
 * @param {string} path - The path to the image.
 * @param {number} retries - Number of retry attempts (optional).
 * @param {number} delay - Delay between retries in milliseconds (optional).
 * @returns {Promise<HTMLImageElement|null>} A promise resolving to an HTMLImageElement or null if failed.
 */
export function loadImage(path, retries = 3, delay = 1000) {
    return new Promise((resolve) => {
        const attemptLoad = (attempt) => {
            const img = new Image();
            img.src = path;
            img.onload = () => resolve(img);
            img.onerror = () => {
                if (attempt < retries) {
                    console.warn(`Retrying to load image: ${path} (Attempt ${attempt + 1})`);
                    setTimeout(() => attemptLoad(attempt + 1), delay);
                } else {
                    console.error(`Failed to load image after ${retries} attempts: ${path}`);
                    resolve(null);
                }
            };
        };

        attemptLoad(0);
    });
}
