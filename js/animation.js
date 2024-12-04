// js/animation.js

import {
    FPS, FRAME_DURATION, BUFFER_SIZE,
} from './config.js';
import { canvas, ctx, offscreenCanvas, offscreenCtx, drawImageWithAspect } from './canvas.js';
import { loadImage } from './loader.js';
import { getRandomInt } from './utils.js';
import { IndexController } from './indexController.js';

let maxIndex = 0; // This will be set after initializing folders
let indexController; // Will be initialized later

// Loaded Folder Lists
let mainFolders = [];
let floatFolders = [];

// Implementing an Image Cache for Preloading Image Pairs
class ImageCache {
    constructor(size) {
        this.size = size;
        this.cache = new Map(); // Map of index to { fgImg, bgImg }
    }

    set(index, item) {
        if (this.cache.size >= this.size) {
            // Remove the oldest entry
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(index, item);
    }

    get(index) {
        return this.cache.get(index);
    }

    has(index) {
        return this.cache.has(index);
    }

    clear() {
        this.cache.clear();
        //console.log('Cache cleared.');
    }

    sizeCurrent() {
        return this.cache.size;
    }
}

const imageCache = new ImageCache(BUFFER_SIZE);

// Additional Variables for Folder Changes
let rand_mult = getRandomInt(1, 9);
let rand_start = getRandomInt(FPS, 5*FPS);
let float_folder = 0;
let main_folder = 0;

// Variables to Track FPS
let frameTimes = [];
let fps = 0;

// Flags
let renderLoopStarted = false;
let isPreloading = false; // Flag to prevent concurrent preloadImages calls

// Flag to Lock Folder Changes During Direction Reversal
let foldersLocked = false;

// Function to draw overlay text on the canvas
function drawOverlayText(ctx, canvas, overallIndex, indexController, fgImg, bgImg, fps, imageCache) {
    const fgName = fgImg.src.split('/').pop();
    const bgName = bgImg.src.split('/').pop();

    ctx.font = '16px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'right';

    // Basic overlay information
    ctx.fillText(`Index: ${overallIndex}, Direction: ${indexController.direction === 1 ? 'Forward' : 'Backward'}`, canvas.width - 10, canvas.height - 130);
    ctx.fillText(`Foreground: ${fgName}`, canvas.width - 10, canvas.height - 110);
    ctx.fillText(`Floatground: ${bgName}`, canvas.width - 10, canvas.height - 90);
    ctx.fillText(`FPS: ${fps}`, canvas.width - 10, canvas.height - 70);
    ctx.fillText(`Cache Size: ${imageCache.sizeCurrent()}`, canvas.width - 10, canvas.height - 50);

    // Expected buffer range
    const bufferRange = Math.floor(BUFFER_SIZE / 2);
    ctx.fillText(`Buffer Range (Expected): ±${bufferRange}`, canvas.width - 10, canvas.height - 10);
}
// Function to Lock Folders
function lockFolders() {
    foldersLocked = true;
    //console.log('Folders locked.');
}

// Function to Unlock Folders
function unlockFolders() {
    foldersLocked = false;
   // console.log('Folders unlocked.');
}

// Function to Update Folders Based on Rules
function updateFolders(index) {

    const direction = indexController.direction;

    // Reset conditions based on direction
    if ((index < rand_start) ||
        (direction === 1 && index > (10 * rand_mult) && index < (12 * rand_mult))) {
        float_folder = 0;
        main_folder = 0;
        rand_start = getRandomInt(FPS, 5*FPS);
        console.log('Folders reset:', float_folder, main_folder);
        return;
    }
        rand_start = getRandomInt(FPS, 5*FPS);
    // Change float folder at intervals
    if (index % ((FPS + 1) * rand_mult) === 0) {
        float_folder = getRandomInt(0, floatFolders.length - 1);
        rand_mult = getRandomInt(1, 12); // Update random multiplier
        console.log('Float folder changed to:', float_folder);
    }

    // Change main folder at different intervals
    if (index % (2 + FPS * rand_mult) === 0) {
        main_folder = getRandomInt(0, mainFolders.length - 1);
        rand_mult = getRandomInt(1, 9); // Update random multiplier
        console.log('Main folder changed to:', main_folder);
    }
}

// Function to Preload Image Pairs into the Cache
async function preloadImages() {
    if (isPreloading) return; // Prevent multiple concurrent preloads
    isPreloading = true;

    //console.log(`Preloading images around index ${indexController.index}, direction=${indexController.direction}`);

    try {
        const preloadIndices = getPreloadIndices(); // Get indices to preload

        for (let idx of preloadIndices) {
            if (imageCache.has(idx)) {
                //console.log(`Skipping preload for index ${idx}: already in cache.`);
                continue;
            }

            const { fgPath, bgPath } = getImagePathsAtIndex(idx);
            //console.log(`Loading images at index ${idx}: FG=${fgPath}, BG=${bgPath}`);

            if (fgPath && bgPath) {
                try {
                    const [fgImg, bgImg] = await Promise.all([loadImage(fgPath), loadImage(bgPath)]);

                    if (fgImg && bgImg) {
                        imageCache.set(idx, { fgImg, bgImg });
                       // console.log(`Cached images at index ${idx}`);
                    } else {
                        console.warn(`Skipping preload for invalid images at index: ${idx}`);
                    }
                } catch (imageError) {
                    console.warn(`Error loading images at index ${idx}:`, imageError);
                }
            }
        }
    } catch (error) {
        console.error('Error during image preloading:', error);
    } finally {
        isPreloading = false;
        //console.log('Preloading completed.');
    }
}

// Function to get indices to preload
function getPreloadIndices() {
    const indices = [];
    const bufferRange = Math.floor(BUFFER_SIZE / 2); // Adjust as needed
    const currentIndex = indexController.index;

    // Preload indices ahead and behind the current index
    for (let offset = -bufferRange; offset <= bufferRange; offset++) {
        let idx = currentIndex + offset;
        if (idx > maxIndex) idx = idx % (maxIndex + 1);
        if (idx < 0) idx = (maxIndex + 1) + idx;
        indices.push(idx);
    }
    return indices;
}

// Function to Get Image Paths at a Specific Index
function getImagePathsAtIndex(index) {
    const fgFolder = mainFolders[main_folder];
    const bgFolder = floatFolders[float_folder];

    if (!fgFolder || !bgFolder) {
        // Folder not available
        return { fgPath: '', bgPath: '' };
    }

    if (!fgFolder.image_list || !Array.isArray(fgFolder.image_list)) {
        // Invalid image_list
        return { fgPath: '', bgPath: '' };
    }

    const fgImages = fgFolder.image_list;
    const bgImages = bgFolder.image_list;

    const fgMaxIndex = fgImages.length - 1;

    let idx = index;

    if (idx < 0) {
        idx = 0;
    } else if (idx > fgMaxIndex) {
        idx = fgMaxIndex;
    }

    const fgIndex = idx % fgImages.length;
    const bgIndex = idx % bgImages.length;
    const fgPath = fgImages[fgIndex];
    const bgPath = bgImages[bgIndex];
    return { fgPath, bgPath };
}

// Function to Get Maximum Index Based on Current Folders
function getMaxIndex() {
    const fgFolder = mainFolders[main_folder];
    return fgFolder.image_list.length - 1;
}

// Render Loop Function
let lastFrameTime = 0;

function renderLoop(timestamp) {
    try {
        // Initialize lastFrameTime during the first call
        if (!lastFrameTime) lastFrameTime = timestamp;

        const elapsed = timestamp - lastFrameTime;

        if (elapsed > FRAME_DURATION) {
            // Update FPS Calculation
            frameTimes.push(elapsed);
            if (frameTimes.length >= FPS) frameTimes.shift();
            const averageDeltaTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
            fps = Math.round(1000 / averageDeltaTime);

            // Throttle console logging to once per second
            if (Math.floor(timestamp / 1000) !== Math.floor(lastFrameTime / 1000)) {
                //console.log(`Elapsed: ${elapsed.toFixed(2)} ms, Average Delta Time: ${averageDeltaTime.toFixed(2)} ms, FPS: ${fps}`);
            }

            lastFrameTime = timestamp; // Reset the last frame time

            const overallIndex = indexController.index; // Use index from the index controller

            if (imageCache.has(overallIndex)) {
                const { fgImg, bgImg } = imageCache.get(overallIndex);
                //console.log(`Rendering frame at index ${overallIndex}`);

                // Update folders based on the current index
                updateFolders(overallIndex);

                // Clear and prepare the offscreen canvas
                offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
                drawImageWithAspect(offscreenCtx, fgImg); // Foreground
                drawImageWithAspect(offscreenCtx, bgImg); // Background

                // Clear and draw the main canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);

                // debugging/display (optional)

                //drawOverlayText(ctx, canvas, overallIndex, indexController, fgImg, bgImg, fps, imageCache);
                // After rendering, increment the index
                indexController.increment();

                // Handle preloading based on cache size
                if (imageCache.sizeCurrent() < BUFFER_SIZE / 2) {
                    //console.log('Cache running low. Initiating preloading.');
                    preloadImages().catch(error => console.error('Preload Images Error:', error));

                }
            } else {
                //console.log(`Image for index ${overallIndex} not in cache. Waiting for preload.`);
                preloadImages().catch(error => console.error('Preload Images Error:', error))
                // Optionally, you can handle this case by showing a placeholder or skipping the frame
            }
        }
    } catch (error) {
        console.error('Error in renderLoop:', error);
    }

    // Request the next frame
    requestAnimationFrame(renderLoop);
}

// Function to Start the Animation
export async function startAnimation() {
    if (renderLoopStarted) return;
    renderLoopStarted = true;

    // Initialize IndexController
    indexController.setIndex(0);
    indexController.setDirection(1);

    // Clear the cache before starting
    imageCache.clear();

    // Preload Initial Images
    await preloadImages();

    // Start the Rendering Loop
    requestAnimationFrame(renderLoop);
}

// Function to Initialize Folders and Load Data
export async function initializeAnimation(mainData, floatData) {
    mainFolders = mainData.folders;
    floatFolders = floatData.folders;

    // Check if folders are empty or of unequal length
    if (mainFolders.length === 0 || floatFolders.length === 0) {
        console.error('No folders found in one or both JSON files.');
        return false;
    }

    if (mainFolders.length !== floatFolders.length) {
        console.error('The number of folders in main folders and float folders do not match.');
        return false;
    }

    // Verify that each folder has an image_list
    for (let idx = 0; idx < mainFolders.length; idx++) {
        const folder = mainFolders[idx];
        if (!folder.image_list || !Array.isArray(folder.image_list) || folder.image_list.length === 0) {
            console.error(`Folder ${idx} in mainFolders is missing a valid 'image_list' array.`);
            return false;
        }
    }

    for (let idx = 0; idx < floatFolders.length; idx++) {
        const folder = floatFolders[idx];
        if (!folder.image_list || !Array.isArray(folder.image_list) || folder.image_list.length === 0) {
            console.error(`Folder ${idx} in floatFolders is missing a valid 'image_list' array.`);
            return false;
        }
    }

    maxIndex = getMaxIndex(); // Now that folders are initialized
    indexController = new IndexController(maxIndex);

// Subscribe to index changes
indexController.onIndexChange((newIndex, direction, event) => {
   // console.log(`Index changed to ${newIndex}, direction: ${direction}`);

    if (event.directionChanged) {
        // Direction changed, clear the cache
        imageCache.clear();
       // console.log('Direction changed. Cache cleared.');
    }

    preloadImages().catch(error => console.error('Preload Images Error:', error));
});


    console.log('Folders initialized successfully.');
    return true;
}
