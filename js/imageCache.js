// js/imageCache.js
import { MAX_CONCURRENT_FETCHES } from './config.js';

/**
 * Loads an image as an HTMLImageElement.
 * @param {string} path - The path to the image.
 * @returns {Promise<HTMLImageElement|null>} A promise resolving to an HTMLImageElement or null if failed.
 */
function loadImage(path) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = path;
        img.onload = () => resolve(img);
        img.onerror = (error) => {
            console.error(`Failed to load image: ${path}`, error);
            resolve(null);
        };
    });
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
     * @param {number} options.cycleLength - The total number of frames in a cycle.
     */
    constructor(bufferSize, options = {}) {
        this.bufferSize = bufferSize;
        this.cache = new Map(); // Map<frameNumber, { fgImg, bgImg }>
        this.cycleLength = options.cycleLength || 1; // Use provided cycleLength
        this.indexController = options.indexController;
        this.folderController = options.folderController;
        this.mainFolders = options.mainFolders;
        this.floatFolders = options.floatFolders;
        this.isPreloading = false; // Prevent concurrent preloads

        // Queue to manage preload order
        this.preloadQueue = [];
    }

    /**
     * Stores an image pair in the cache.
     * @param {number} frameNumber - The frame number for the cached images.
     * @param {object} item - The { fgImg, bgImg } object, both are HTMLImageElements.
     */
    set(frameNumber, item) {
        this.cache.set(frameNumber, item);
        // console.log(`Cached images at frame: ${frameNumber}`);

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
     * Calculates how many frames are remaining in the buffer relative to the current frame.
     * @param {number} currentFrame - The current frame number.
     * @returns {number} Number of frames remaining in the buffer.
     */
    getFramesRemaining(currentFrame) {
        let remaining = 0;
        for (let i = 1; i <= this.bufferSize; i++) {
            const nextFrame = (currentFrame + i) % this.cycleLength;
            if (this.has(nextFrame)) {
                remaining++;
            }
        }
        return remaining;
    }

    /**
     * Preloads images for upcoming frames based on the buffer size.
     * Utilizes concurrency control to limit simultaneous fetches.
     * Ensures that images are loaded in advance to prevent rendering delays.
     */
async preloadImages() {
    if (this.isPreloading) return;
    this.isPreloading = true;

    try {
        const bufferSize = this.bufferSize;
        const currentFrame = this.indexController.getCurrentFrameNumber();
        const preloadFrames = this.getPreloadFrames(currentFrame, bufferSize);
        const framesToPreload = preloadFrames.filter(frameNumber => !this.has(frameNumber));

        const concurrencyLimit = MAX_CONCURRENT_FETCHES || 5;
        const queue = [...framesToPreload];
        const workers = [];

        const worker = async () => {
            while (queue.length > 0) {
                const frameNumber = queue.shift();
                await this.loadAndCacheFrame(frameNumber);
            }
        };

        for (let i = 0; i < concurrencyLimit; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);
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
            const nextFrame = (currentFrame + i) % this.cycleLength;
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
            // Load both images as HTMLImageElement
            const [fgImg, bgImg] = await Promise.all([
                loadImage(mainImage),
                loadImage(floatImage)
            ]);

            if (fgImg && bgImg) {
                this.set(frameNumber, { fgImg, bgImg });
                //console.log(`Preloaded images for frame: ${frameNumber}`);
            } else {
                console.warn(`Skipping preload for invalid images at frame: ${frameNumber}`);
            }
        } catch (imageError) {
            console.warn(`Error loading images for frame ${frameNumber}:`, imageError);
        }
    }

    /**
     * Trims the cache to remove frames that are no longer needed.
     * Ensures that only the required frames within the buffer are kept.
     */
trimCache() {
    const currentFrame = this.indexController.getCurrentFrameNumber();
    const validFrames = new Set([
        currentFrame,
        ...this.getPreloadFrames(currentFrame, this.bufferSize)
    ]);

    for (const frameNumber of this.cache.keys()) {
        if (!validFrames.has(frameNumber)) {
            this.cache.delete(frameNumber);
            // Optionally, you can also nullify references to help garbage collection
        }
    }
}
}
