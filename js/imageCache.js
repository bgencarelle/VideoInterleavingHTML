// imageCache.js
import { BUFFER_SIZE } from './config.js';

/**
 * Loads and decodes an image off the main thread using createImageBitmap.
 * @param {string} path - The path to the image.
 * @returns {Promise<ImageBitmap|null>} A promise resolving to an ImageBitmap or null if fail.
 */
async function loadImageBitmap(path) {
    const encodedPath = encodeURI(path);
    try {
        const response = await fetch(encodedPath);
        if (!response.ok) {
            console.error(`Failed to fetch image: ${path}, status: ${response.status}`);
            return null;
        }
        const blob = await response.blob();
        try {
            // createImageBitmap decodes off the main thread
            const bitmap = await createImageBitmap(blob);
            return bitmap;
        } catch (decodeError) {
            console.error(`Failed to decode image bitmap: ${path}`, decodeError);
            return null;
        }
    } catch (networkError) {
        console.error(`Network error while fetching image: ${path}`, networkError);
        return null;
    }
}

/**
 * ImageCache is responsible for caching image pairs (foreground/background) at certain indices.
 * It relies on IndexController and FolderController to know which indices and folders to preload.
 * Precomputation ensures that when the renderer requests an index, the needed images are likely ready.
 */
export class ImageCache {
    /**
     * @param {number} size - Maximum number of items to hold in the cache.
     * @param {object} options - Additional references for folder and index controllers.
     */
    constructor(size, options = {}) {
        this.size = size;
        this.cache = new Map(); // Map<index, { fgImg, bgImg }>
        this.indexController = options.indexController;
        this.folderController = options.folderController;
        this.mainFolders = options.mainFolders;
        this.floatFolders = options.floatFolders;
        this.isPreloading = false; // Prevent concurrent preloads
    }

    /**
     * Store an item in the cache. If the cache is full, removes the oldest entry.
     * @param {number} index - The index for the cached item.
     * @param {object} item - The { fgImg, bgImg } object, both are ImageBitmaps now.
     */
    set(index, item) {
        if (this.cache.size >= this.size) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(index, item);
    }

    /**
     * Retrieve an item from the cache.
     * @param {number} index - The index for the requested item.
     * @returns {object|undefined} - The cached { fgImg, bgImg } or undefined if not found.
     */
    get(index) {
        return this.cache.get(index);
    }

    /**
     * Check if an item exists in the cache.
     * @param {number} index - The index to check.
     * @returns {boolean} True if the item is cached, false otherwise.
     */
    has(index) {
        return this.cache.has(index);
    }

    /**
     * Clears the entire cache.
     * Other scripts might call this (for example, on mode switches), so we keep it intact.
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Returns the current number of cached items.
     * @returns {number} The size of the cache.
     */
    sizeCurrent() {
        return this.cache.size;
    }

    /**
     * Preloads images for the indices determined by the controllers. Prevents concurrent calls.
     * If images are already cached or invalid, it skips them.
     * Uses createImageBitmap for efficient off-main-thread decoding.
     */
    async preloadImages() {
        if (this.isPreloading) return; // Avoid races and overlapping loads
        this.isPreloading = true;

        try {
            const indices = this.indexController.getPreloadIndices(BUFFER_SIZE);
            const preloadInfos = this.folderController.getPreloadInfo(indices);

            for (const preloadInfo of preloadInfos) {
                let { index, main_folder, float_folder } = preloadInfo;

                const fgFolder = this.mainFolders[main_folder];
                if (!fgFolder || !Array.isArray(fgFolder.image_list) || fgFolder.image_list.length === 0) {
                    continue; // Invalid or empty main folder
                }

                const maxIndex = fgFolder.image_list.length - 1;
                if (index < 0) index = 0;
                else if (index > maxIndex) index = maxIndex;

                if (this.has(index)) continue; // Already cached

                const bgFolder = this.floatFolders[float_folder];
                if (!bgFolder || !Array.isArray(bgFolder.image_list) || bgFolder.image_list.length === 0) {
                    // Float folder invalid or empty
                    continue;
                }

                const fgImages = fgFolder.image_list;
                const bgImages = bgFolder.image_list;
                const fgIndex = index % fgImages.length;
                const bgIndex = index % bgImages.length;
                const fgPath = fgImages[fgIndex];
                const bgPath = bgImages[bgIndex];

                if (!fgPath || !bgPath) {
                    // Missing image paths
                    continue;
                }

                try {
                    // Decode both images off-main-thread
                    const [fgImg, bgImg] = await Promise.all([
                        loadImageBitmap(fgPath),
                        loadImageBitmap(bgPath)
                    ]);

                    if (fgImg && bgImg) {
                        this.set(index, { fgImg, bgImg });
                    } else {
                        console.warn(`Skipping preload for invalid images at index: ${index}`);
                    }
                } catch (imageError) {
                    console.warn(`Error loading images at index ${index}:`, imageError);
                }
            }
        } catch (error) {
            console.error('Error during image preloading:', error);
        } finally {
            this.isPreloading = false;
        }
    }
}
