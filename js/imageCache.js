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

        // We track if a trim is needed rather than trimming on every set
        this.needsTrim = false;
    }

    set(frameNumber, item) {
        this.cache.set(frameNumber, item);
        // Mark that we may need to trim, but don't do it yet
        this.needsTrim = true;
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

            const worker = async () => {
                while (queue.length > 0) {
                    const frameNumber = queue.shift();
                    await this.loadAndCacheFrame(frameNumber);
                }
            };

            const workers = [];
            for (let i = 0; i < concurrencyLimit; i++) {
                workers.push(worker());
            }

            await Promise.all(workers);
        } catch (error) {
            console.error('Error during image preloading:', error);
        } finally {
            this.isPreloading = false;
            // Now that we've done a preload cycle, if we need to trim, do it once here
            if (this.needsTrim) {
                this.trimCache(currentFrame, preloadFrames);
                this.needsTrim = false;
            }
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
        // **Important:** We reintroduce the folderController update here to ensure mode-dependent changes
        // remain responsive, as required.
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
        }
    }

    trimCache(currentFrame, preloadFrames) {
        // We reuse preloadFrames instead of calling getPreloadFrames() again
        const validFrames = new Set([currentFrame, ...preloadFrames]);

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
