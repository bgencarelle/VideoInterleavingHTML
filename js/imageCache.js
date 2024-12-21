// js/imageCache.js
import { MAX_CONCURRENT_FETCHES } from './config.js';
import { loadImage } from './loadImageHttp.js';

export class ImageCache {
    constructor(bufferSize, options = {}) {
        this.bufferSize = bufferSize;
        this.buffer = new Array(bufferSize).fill(null); // Preallocate buffer
        this.head = 0; // Points to the oldest entry
        this.tail = 0; // Points to the next insertion point
        this.isFull = false; // Indicates if the buffer is FULL

        this.cycleLength = options.cycleLength || 1;
        this.indexController = options.indexController;
        this.folderController = options.folderController;
        this.mainFolders = options.mainFolders;
        this.floatFolders = options.floatFolders;
        this.isPreloading = false;

        this.framesSinceLastPreload = 0;
        this.preloadCooldown = 5; // Same logic as before

        // No need for needsTrim flag since circular buffer handles it
    }

    /**
     * Adds a new image pair to the buffer.
     * Overwrites the oldest entry if the buffer is full.
     * @param {number} frameNumber
     * @param {Object} item - Contains fgImgSrc and bgImgSrc
     */
    set(frameNumber, item) {
        this.buffer[this.tail] = { frameNumber, ...item };
        this.tail = (this.tail + 1) % this.bufferSize;

        if (this.isFull) {
            // Overwrite the oldest entry by moving head forward
            this.head = (this.head + 1) % this.bufferSize;
        }

        if (this.tail === this.head) {
            this.isFull = true;
        }
    }

    /**
     * Retrieves the image pair for the specified frameNumber.
     * @param {number} frameNumber
     * @returns {Object|null} - Contains fgImgSrc and bgImgSrc or null if not found
     */
    get(frameNumber) {
        for (let i = 0; i < this.bufferSize; i++) {
            const index = (this.head + i) % this.bufferSize;
            const entry = this.buffer[index];
            if (entry && entry.frameNumber === frameNumber) {
                return { fgImgSrc: entry.fgImgSrc, bgImgSrc: entry.bgImgSrc };
            }
        }
        return null;
    }

    /**
     * Checks if the buffer contains the specified frameNumber.
     * @param {number} frameNumber
     * @returns {boolean}
     */
    has(frameNumber) {
        for (let i = 0; i < this.bufferSize; i++) {
            const index = (this.head + i) % this.bufferSize;
            const entry = this.buffer[index];
            if (entry && entry.frameNumber === frameNumber) {
                return true;
            }
        }
        return false;
    }

    /**
     * Handles frame rendering by potentially triggering preloading.
     * @param {number} currentFrame
     */
    async handleFrameRender(currentFrame) {
        this.framesSinceLastPreload++;
        await this.preloadImages(currentFrame);
    }

    /**
     * Preloads images based on the current frame and buffer size.
     * Implements concurrency control and cooldown logic.
     * @param {number} currentFrame
     */
    async preloadImages(currentFrame) {
        if (this.isPreloading) return;

        const preloadFrames = this.getPreloadFrames(currentFrame, this.bufferSize);
        const framesNeeded = preloadFrames.filter(f => !this.has(f));

        // If no frames needed, skip preloading
        if (framesNeeded.length === 0) {
            return;
        }

        // Check how many frames are cached
        const cachedCount = preloadFrames.filter(f => this.has(f)).length;
        const halfBuffer = Math.floor(this.bufferSize / 2);

        // If more than half are cached and the cooldown hasn't elapsed, skip this preload round
        if (cachedCount > halfBuffer && this.framesSinceLastPreload < this.preloadCooldown) {
            return;
        }

        // Update folders once here
        this.folderController.updateFolders(currentFrame);

        this.isPreloading = true;
        this.framesSinceLastPreload = 0;

        try {
            const concurrencyLimit = MAX_CONCURRENT_FETCHES || 5;
            const queue = [...framesNeeded];

            // Create worker functions based on concurrencyLimit
            const workers = [];
            for (let i = 0; i < concurrencyLimit; i++) {
                workers.push(this.worker(queue));
            }

            await Promise.all(workers);
        } catch (error) {
            console.error('Error during image preloading:', error);
        } finally {
            this.isPreloading = false;
            // No need for trimCache since circular buffer handles overwrites
        }
    }

    /**
     * Worker function to process the preload queue.
     * @param {Array<number>} queue
     */
    async worker(queue) {
        while (queue.length > 0) {
            const frameNumber = queue.shift();
            await this.loadAndCacheFrame(frameNumber);
        }
    }

    /**
     * Determines which frames need to be preloaded based on the current frame and buffer size.
     * @param {number} currentFrame
     * @param {number} bufferSize
     * @returns {Array<number>} - Array of frameNumbers to preload
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
     * Loads images for a specific frame and adds them to the buffer.
     * @param {number} frameNumber
     */
    async loadAndCacheFrame(frameNumber) {
        // Reintroduce folderController update to ensure mode-dependent changes
        this.folderController.updateFolders(frameNumber);

        const filePaths = this.folderController.getFilePaths(frameNumber);
        const { mainImage, floatImage } = filePaths;

        if (!mainImage || !floatImage) return;

        try {
            const [bgImg, fgImg] = await Promise.all([
                loadImage(mainImage),
                loadImage(floatImage)
            ]);

            if (bgImg && fgImg) {
                this.set(frameNumber, { fgImgSrc: fgImg.src, bgImgSrc: bgImg.src });
            }
        } catch (imageError) {
            // Skip silently if images fail to load
            console.warn(`Failed to load images for frame ${frameNumber}:`, imageError);
        }
    }

    /**
     * Preloads initial images to fill the buffer.
     * @param {number} initialFrame
     */
    async preloadInitialImages(initialFrame) {
        // Force immediate preload initially
        this.framesSinceLastPreload = this.preloadCooldown;
        await this.preloadImages(initialFrame);
    }
}
