//imageCache.js
import { BUFFER_SIZE } from './config.js';


/**
 * Loads an image and returns a Promise that resolves with the image.
 * @param {string} path - The path to the image.
 * @returns {Promise<HTMLImageElement>} A promise that resolves with the loaded image.
 */
async function loadImage(path) {
    return new Promise((resolve) => {
        let encodedPath = encodeURI(path);
        let img = new Image();
        img.src = encodedPath;
        img.onload = () => {
            resolve(img);
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${path}`);
            resolve(null);
        };
    });
}
/**
 * Implements an Image Cache for Preloading Image Pairs.
 */
export class ImageCache {
    /**
     * Creates an instance of ImageCache.
     * @param {number} size - The maximum size of the cache.
     * @param {object} options - Additional options for the cache.
     */
    constructor(size, options = {}) {
        this.size = size;
        this.cache = new Map(); // Map of index to { fgImg, bgImg }

        // Store references to controllers and folders
        this.indexController = options.indexController;
        this.folderController = options.folderController;
        this.mainFolders = options.mainFolders;
        this.floatFolders = options.floatFolders;

        // Internal state
        this.isPreloading = false;
    }

    /**
     * Adds an item to the cache.
     * @param {number} index - The index of the item.
     * @param {object} item - The item to cache.
     */
    set(index, item) {
        if (this.cache.size >= this.size) {
            // Remove the oldest entry
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(index, item);
    }

    /**
     * Retrieves an item from the cache.
     * @param {number} index - The index of the item.
     * @returns {object} The cached item.
     */
    get(index) {
        return this.cache.get(index);
    }

    /**
     * Checks if an item exists in the cache.
     * @param {number} index - The index of the item.
     * @returns {boolean} True if the item exists, false otherwise.
     */
    has(index) {
        return this.cache.has(index);
    }

    /**
     * Clears all items from the cache.
     */
    clear() {
        this.cache.clear();
        // console.log('Cache cleared.');
    }

    /**
     * Retrieves the current size of the cache.
     * @returns {number} The number of items in the cache.
     */
    sizeCurrent() {
        return this.cache.size;
    }

    /**
     * Preloads image pairs into the cache based on preload information.
     * This method encapsulates the preload logic.
     */
    async preloadImages() {
        if (this.isPreloading) return; // Prevent multiple concurrent preloads
        this.isPreloading = true;

        try {
            // Get preload indices from IndexController
            const indices = this.indexController.getPreloadIndices(BUFFER_SIZE);

            // Get preload info from FolderController
            const preloadInfos = this.folderController.getPreloadInfo(indices);

            for (let preloadInfo of preloadInfos) {
                let { index, main_folder, float_folder } = preloadInfo;

                // Adjust index based on maxIndex
                const fgFolder = this.mainFolders[main_folder];
                const maxIndex = fgFolder.image_list.length - 1;

                if (index < 0) {
                    index = 0;
                } else if (index > maxIndex) {
                    index = maxIndex;
                }

                if (this.has(index)) {
                    // Skip if already cached
                    continue;
                }

                // Determine image paths based on folder selections
                const bgFolder = this.floatFolders[float_folder];

                if (!fgFolder || !bgFolder) {
                    // Folder not available
                    continue;
                }

                if (!fgFolder.image_list || !Array.isArray(fgFolder.image_list)) {
                    // Invalid image_list
                    continue;
                }

                const fgImages = fgFolder.image_list;
                const bgImages = bgFolder.image_list;

                const fgIndex = index % fgImages.length;
                const bgIndex = index % bgImages.length;
                const fgPath = fgImages[fgIndex];
                const bgPath = bgImages[bgIndex];

                if (fgPath && bgPath) {
                    try {
                        const [fgImg, bgImg] = await Promise.all([loadImage(fgPath), loadImage(bgPath)]);

                        if (fgImg && bgImg) {
                            this.set(index, { fgImg, bgImg });
                            // Optionally, log successful caching
                            // console.log(`Cached images at index ${index}`);
                        } else {
                            console.warn(`Skipping preload for invalid images at index: ${index}`);
                        }
                    } catch (imageError) {
                        console.warn(`Error loading images at index ${index}:`, imageError);
                    }
                }
            }
        } catch (error) {
            console.error('Error during image preloading:', error);
        } finally {
            this.isPreloading = false;
        }
    }
}
