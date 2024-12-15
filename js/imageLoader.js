// js/loadImageBitmap.js

/**
 * Loads an image as an ImageBitmap with retry capability using Fetch API.
 * @param {string} path - The path to the image (can be a file:// URL or a Data URL).
 * @param {number} retries - Number of retry attempts (optional).
 * @param {number} delay - Delay between retries in milliseconds (optional).
 * @returns {Promise<ImageBitmap|null>} A promise resolving to an ImageBitmap or null if failed.
 */
export async function loadImage(path, retries = 3, delay = 10) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            const response = await fetch(path, { mode: 'cors' }); // Adjust mode as needed
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const blob = await response.blob();
            const imageBitmap = await createImageBitmap(blob);
            //console.log(`ImageBitmap loaded successfully from: ${path}`);
            return imageBitmap;
        } catch (error) {
            if (attempt <= retries) {
                console.warn(`Retrying to load ImageBitmap: ${path} (Attempt ${attempt})`);
                await new Promise(res => setTimeout(res, delay));
            } else {
                console.error(`Failed to load ImageBitmap after ${retries} attempts: ${path}`, error);
                return null;
            }
        }
    }
}
