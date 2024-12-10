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
            return await createImageBitmap(blob);
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
 * ImageCache is responsible for caching image pairs (foreground/background) based on frame numbers.
 * It relies on IndexController and FolderController to know which frames to preload.
 * Preloading is managed to ensure that the buffer is always stocked with upcoming frames.
 */
export class ImageCache {
    /**
     * @param {number} bufferSize - Maximum number of frames to hold in the cache.
     * @param {object} options - Additional references for folder and index controllers.
     * @param {IndexController} options.indexController - The IndexController instance.
     * @param {FolderController} options.folderController - The FolderController instance.
     * @param {Array<Object>} options.mainFolders - Array of main folder objects.
     * @param {Array<Object>} options.floatFolders - Array of float folder objects.
     */
    constructor(bufferSize, options = {}) {
        this.bufferSize = bufferSize;
        this.cache = new Map(); // Map<frameNumber, { fgImg, bgImg }>
        this.indexController = options.indexController;
        this.folderController = options.folderController;
        this.mainFolders = options.mainFolders;
        this.floatFolders = options.floatFolders;
        this.isPreloading = false; // Prevent concurrent preloads

        // Track the highest frame number preloaded
        this.highestPreloadedFrame = -1;
    }

    /**
     * Stores an image pair in the cache. If the cache exceeds the buffer size, removes the oldest entry.
     * @param {number} frameNumber - The frame number for the cached images.
     * @param {object} item - The { fgImg, bgImg } object, both are ImageBitmaps.
     */
    set(frameNumber, item) {
        this.cache.set(frameNumber, item);
        //console.log(`Cached images at frame: ${frameNumber}`);

        // Update the highest preloaded frame
        if (frameNumber > this.highestPreloadedFrame) {
            this.highestPreloadedFrame = frameNumber;
        }

        // Trim the cache to maintain buffer size
        this.trimCache();
    }

    /**
     * Retrieves an image pair from the cache based on the frame number.
     * @param {number} frameNumber - The frame number for the requested images.
     * @returns {object|undefined} - The cached { fgImg, bgImg } or undefined if not found.
     */
    get(frameNumber) {
        return this.cache.get(frameNumber);
    }

    /**
     * Checks if an image pair exists in the cache for a given frame number.
     * @param {number} frameNumber - The frame number to check.
     * @returns {boolean} True if the images are cached, false otherwise.
     */
    has(frameNumber) {
        return this.cache.has(frameNumber);
    }

    /**
     * Preloads images for upcoming frames based on the buffer size.
     * Utilizes concurrency control to limit simultaneous fetches.
     * Ensures that images are loaded in advance to prevent rendering delays.
     */
    async preloadImages() {
        if (this.isPreloading) return; // Prevent overlapping preloads
        this.isPreloading = true;

        //console.log('Starting image preloading...');

        try {
            const bufferSize = this.bufferSize;
            const currentFrame = this.indexController.getCurrentFrameNumber();
            const preloadFrames = this.getPreloadFrames(currentFrame, bufferSize);

            // Filter out frames that are already cached or invalid
            const validPreloadFrames = preloadFrames.filter(frameNumber => {
                if (this.has(frameNumber)) return false; // Already cached

                // Get file paths for the frame
                const filePaths = this.folderController.getFilePaths(frameNumber);
                if (!filePaths.mainImage || !filePaths.floatImage) {
                    console.warn(`Invalid file paths for frame: ${frameNumber}`);
                    return false;
                }

                return true;
            });

            //console.log(`Preloading ${validPreloadFrames.length} frames...`);

            // Implement concurrency control
            const concurrencyLimit = MAX_CONCURRENT_FETCHES || 5;
            const preloadQueue = [...validPreloadFrames];
            let activePromises = [];

            while (preloadQueue.length > 0 || activePromises.length > 0) {
                while (activePromises.length < concurrencyLimit && preloadQueue.length > 0) {
                    const frameNumber = preloadQueue.shift();
                    const promise = this.loadAndCacheFrame(frameNumber);
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

            //console.log('Image preloading completed.');
        } catch (error) {
            console.error('Error during image preloading:', error);
        } finally {
            this.isPreloading = false;
        }
    }

    /**
     * Determines which frames to preload based on the current frame and buffer size.
     * Only preloads upcoming frames.
     * @param {number} currentFrame - The current frame number.
     * @param {number} bufferSize - The size of the buffer.
     * @returns {Array<number>} An array of frame numbers to preload.
     */
    getPreloadFrames(currentFrame, bufferSize) {
        const preloadFrames = [];

        for (let i = 1; i <= bufferSize; i++) {
            const nextFrame = currentFrame + i;
            preloadFrames.push(nextFrame);
        }

        return preloadFrames;
    }

    /**
     * Loads and caches images for a specific frame number.
     * @param {number} frameNumber - The frame number to load.
     */
    async loadAndCacheFrame(frameNumber) {
        const filePaths = this.folderController.getFilePaths(frameNumber);
        const { mainImage, floatImage } = filePaths;

        if (!mainImage || !floatImage) {
            console.warn(`Missing image paths for frame: ${frameNumber}`);
            return;
        }

        try {
            // Decode both images off-main-thread
            const [fgImg, bgImg] = await Promise.all([
                loadImageBitmap(mainImage),
                loadImageBitmap(floatImage)
            ]);

            if (fgImg && bgImg) {
                this.set(frameNumber, { fgImg, bgImg });
                console.log(`Preloaded images for frame: ${frameNumber}`);
            } else {
                console.warn(`Skipping preload for invalid images at frame: ${frameNumber}`);
            }
        } catch (imageError) {
            console.warn(`Error loading images for frame ${frameNumber}:`, imageError);
        }
    }

    /**
     * Trims the cache to remove frames that are no longer needed.
     * Since it's a flipbook, frames behind the current frame are not needed.
     */
    trimCache() {
        const currentFrame = this.indexController.getCurrentFrameNumber();
        const bufferSize = this.bufferSize;

        // Define the minimum frame that should be kept in the cache
        const minFrame = currentFrame;

        // Remove any frames less than minFrame
        for (const frameNumber of this.cache.keys()) {
            if (frameNumber < minFrame) {
                this.cache.delete(frameNumber);
                console.log(`Trimmed frame ${frameNumber} from cache.`);
            }
        }

        // Ensure buffer does not exceed bufferSize
        while (this.cache.size > bufferSize) {
            // Find the smallest frame number in the cache
            const smallestFrame = Math.min(...this.cache.keys());
            this.cache.delete(smallestFrame);
            console.log(`Trimmed frame ${smallestFrame} from cache to maintain buffer size.`);
        }
    }
}
