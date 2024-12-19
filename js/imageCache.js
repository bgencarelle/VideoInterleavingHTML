// js/imageCache.js
import { MAX_CONCURRENT_FETCHES } from './config.js';
import { loadImage } from './loadImageHttp.js';

export class ImageCache {
    constructor(bufferSize, options = {}) {
        this.bufferSize = bufferSize;
        this.cache = new Map();
        this.cycleLength = options.cycleLength || 1;
        this.indexController = options.indexController;
        this.folderController = options.folderController;
        this.mainFolders = options.mainFolders;
        this.floatFolders = options.floatFolders;
        this.isPreloading = false;

        this.framesSinceLastPreload = 0;
        this.preloadCooldown = 5; // same logic as before
    }

    set(frameNumber, item) {
        this.cache.set(frameNumber, item);
        this.trimCache();
    }

    get(frameNumber) {
        return this.cache.get(frameNumber) || null;
    }

    has(frameNumber) {
        return this.cache.has(frameNumber);
    }

    async handleFrameRender(currentFrame) {
        this.framesSinceLastPreload++;
        await this.preloadImages(currentFrame);
    }

    async preloadImages(currentFrame) {
        if (this.isPreloading) return;

        const preloadFrames = this.getPreloadFrames(currentFrame, this.bufferSize);
        const framesNeeded = preloadFrames.filter(f => !this.has(f));

        // If no frames needed, skip
        if (framesNeeded.length === 0) return;

        // Check how many frames are already cached
        const cachedCount = preloadFrames.filter(f => this.has(f)).length;
        // If more than half are already cached, maybe skip this attempt
        const halfBuffer = Math.floor(this.bufferSize / 2);
        if (cachedCount > halfBuffer && this.framesSinceLastPreload < this.preloadCooldown) {
            // We have more than half preloaded and haven't waited long enough, skip preloading
            return;
        }

        // If buffer is less than half full or cooldown passed, let's update folders and load
        // Update folders just once before loading
        this.folderController.updateFolders(currentFrame);

        // Now actually preload
        this.isPreloading = true;
        this.framesSinceLastPreload = 0;

        try {
            const concurrencyLimit = MAX_CONCURRENT_FETCHES || 5;
            const queue = [...framesNeeded];
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

    getPreloadFrames(currentFrame, bufferSize) {
        const preloadFrames = [];
        for (let i = 1; i <= bufferSize; i++) {
            const nextFrame = (currentFrame + i) % this.cycleLength;
            preloadFrames.push(nextFrame);
        }
        return preloadFrames;
    }

    async loadAndCacheFrame(frameNumber) {
        // Now we assume folderController was already updated
        this.folderController.updateFolders(frameNumber);
        const filePaths = this.folderController.getFilePaths(frameNumber);
        const { mainImage, floatImage } = filePaths;

        if (!mainImage || !floatImage) {
            return;
        }

        try {
            const [bgImg, fgImg] = await Promise.all([
                loadImage(mainImage),
                loadImage(floatImage)
            ]);

            if (bgImg && fgImg) {
                this.set(frameNumber, { fgImgSrc: fgImg.src, bgImgSrc: bgImg.src });
            }
        } catch (imageError) {
            // skip failed frames silently
        }
    }

    trimCache() {
        const currentFrame = this.indexController.getCurrentFrameNumber();
        const validFrames = new Set([
            currentFrame,
            ...this.getPreloadFrames(currentFrame, this.bufferSize)
        ]);

        for (const frameNumber of this.cache.keys()) {
            if (!validFrames.has(frameNumber)) {
                this.cache.delete(frameNumber);
            }
        }
    }

    async preloadInitialImages(initialFrame) {
        // Force immediate preload initially
        this.framesSinceLastPreload = this.preloadCooldown;
        await this.preloadImages(initialFrame);
    }
}
