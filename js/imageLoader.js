/**
 * Loads an image as an HTMLImageElement with retry capability.
 * @param {string} path - The path to the image (can be a file:// URL or a Data URL).
 * @param {number} retries - Number of retry attempts (optional).
 * @param {number} delay - Delay between retries in milliseconds (optional).
 * @returns {Promise<HTMLImageElement|null>} A promise resolving to an HTMLImageElement or null if failed.
 */
export function loadImage(path, retries = 3, delay = 1000) {
    return new Promise((resolve) => {
        const attemptLoad = (attempt) => {
            const img = new Image();

            // Handle local file paths (file://)
            if (path.startsWith('file://')) {
                img.src = path;  // This is used for local files directly
            } else {
                img.src = path;  // For other paths (URLs or Data URLs)
            }

            img.onload = () => {
                //console.log(`Image loaded successfully from: ${path}`);
                resolve(img);
            };
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
