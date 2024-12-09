// js/imageCache.js
import { BUFFER_SIZE, MAX_CONCURRENT_FETCHES } from './config.js';

/**
 * Loads and decodes an image off the main thread using createImageBitmap.
 * @param {string} path - The path to the image.
 * @returns {Promise<ImageBitmap|null>} A promise resolving to an ImageBitmap or null if failed.
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
     * @param {object} item - The { fgImg, bgImg } object, both are ImageBitmaps.
     */
    set(index, item) {
        if (this.cache.size >= this.size) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
            console.log(`Cache full. Removed oldest image at index: ${oldestKey}`);
        }
        this.cache.set(index, item);
        console.log(`Cached images at index: ${index}`);
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
        console.log('Image cache cleared.');
    }

    /**
     * Returns the current number of cached items.
     * @returns {number} The size of the cache.
     */
    size() {
        return this.cache.size;
    }

    /**
     * Preloads images for the indices determined by the controllers. Prevents concurrent calls.
     * If images are already cached or invalid, it skips them.
     * Uses createImageBitmap for efficient off-main-thread decoding.
     * Implements concurrency control to limit simultaneous fetches.
     */
    async preloadImages() {
        if (this.isPreloading) return; // Avoid races and overlapping loads
        this.isPreloading = true;

        console.log('Starting image preloading...');

        try {
            const bufferSize = BUFFER_SIZE;
            const indices = this.indexController.getPreloadIndices(bufferSize);
            const preloadInfos = this.folderController.getPreloadInfo(indices);

            // Filter out preloadInfos that are already cached or invalid
            const validPreloadInfos = preloadInfos.filter(preloadInfo => {
                const { index, main_folder, float_folder } = preloadInfo;
                const fgFolder = this.mainFolders[main_folder];
                const bgFolder = this.floatFolders[float_folder];

                // Validate folders
                if (!fgFolder || !Array.isArray(fgFolder.image_list) || fgFolder.image_list.length === 0) {
                    console.warn(`Invalid or empty main folder: ${main_folder}`);
                    return false;
                }
                if (!bgFolder || !Array.isArray(bgFolder.image_list) || bgFolder.image_list.length === 0) {
                    console.warn(`Invalid or empty float folder: ${float_folder}`);
                    return false;
                }

                // Clamp index within valid range
                const maxIndex = fgFolder.image_list.length - 1;
                const clampedIndex = Math.max(0, Math.min(index, maxIndex));

                // Skip if already cached
                if (this.has(clampedIndex)) return false;

                return true;
            });

            console.log(`Preloading ${validPreloadInfos.length} images...`);

            // Implement concurrency control
            const concurrencyLimit = MAX_CONCURRENT_FETCHES || 5;
            const preloadQueue = [...validPreloadInfos];
            let activePromises = [];

            while (preloadQueue.length > 0 || activePromises.length > 0) {
                while (activePromises.length < concurrencyLimit && preloadQueue.length > 0) {
                    const preloadInfo = preloadQueue.shift();
                    const promise = this.loadAndCacheImage(preloadInfo);
                    activePromises.push(promise);

                    // Remove resolved promises from activePromises
                    promise.finally(() => {
                        activePromises = activePromises.filter(p => p !== promise);
                    });
                }

                // Wait for any of the active promises to resolve before continuing
                if (activePromises.length > 0) {
                    await Promise.race(activePromises);
                }
            }

            console.log('Image preloading completed.');
        } catch (error) {
            console.error('Error during image preloading:', error);
        } finally {
            this.isPreloading = false;
        }
    }

    /**
     * Loads and caches images based on preloadInfo.
     * @param {object} preloadInfo - Contains index, main_folder, and float_folder.
     */
    async loadAndCacheImage(preloadInfo) {
        const { index, main_folder, float_folder } = preloadInfo;

        const fgFolder = this.mainFolders[main_folder];
        const bgFolder = this.floatFolders[float_folder];
        const maxIndex = fgFolder.image_list.length - 1;

        // Clamp index within valid range
        const clampedIndex = Math.max(0, Math.min(index, maxIndex));

        const fgImages = fgFolder.image_list;
        const bgImages = bgFolder.image_list;
        const fgIndex = clampedIndex % fgImages.length;
        const bgIndex = clampedIndex % bgImages.length;
        const fgPath = fgImages[fgIndex];
        const bgPath = bgImages[bgIndex];

        if (!fgPath || !bgPath) {
            console.warn(`Missing image paths for index: ${clampedIndex}`);
            return;
        }

        try {
            // Decode both images off-main-thread
            const [fgImg, bgImg] = await Promise.all([
                loadImageBitmap(fgPath),
                loadImageBitmap(bgPath)
            ]);

            if (fgImg && bgImg) {
                this.set(clampedIndex, { fgImg, bgImg });
                console.log(`Preloaded images at index: ${clampedIndex}`);
            } else {
                console.warn(`Skipping preload for invalid images at index: ${clampedIndex}`);
            }
        } catch (imageError) {
            console.warn(`Error loading images at index ${clampedIndex}:`, imageError);
        }
    }
}
