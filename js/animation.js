// js/animation.js

import {
    FPS, FRAME_DURATION, BUFFER_SIZE,
} from './config.js';
import { canvas, ctx, offscreenCanvas, offscreenCtx, drawImageWithAspect } from './canvas.js';
import { loadImage } from './loader.js';
import { getRandomInt } from './utils.js';
import { IndexController } from './indexController.js';
import { drawOverlayText } from './utils.js';
import { calculateFPS } from './utils.js';
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

// Function to draw overlay text on the canvas

// Function to Change File Source Folders Based on Rules
function changeFileSourceFolder(index, state) {
    const direction = state.indexController.direction;

    let folderChanged = false;

    // Reset conditions based on direction
    if (
        (index < state.rand_start) ||
        (direction === 1 && index > (10 * state.rand_mult) && index < (12 * state.rand_mult))
    ) {
        state.float_folder = 0;
        state.main_folder = 0;
        state.rand_start = getRandomInt(FPS, 5 * FPS);
        console.log('Folders reset:', state.float_folder, state.main_folder);
        folderChanged = true;

        // Schedule the next reset
        state.nextResetIndex = index + state.rand_start;
    } else {
        state.rand_start = getRandomInt(FPS, 5 * FPS);

        // Change float folder at intervals
        if (index % ((FPS + 1) * state.rand_mult) === 0) {
            state.float_folder = getRandomInt(0, state.floatFolders.length - 1);
            state.rand_mult = getRandomInt(1, 12); // Update random multiplier
            console.log('Float folder changed to:', state.float_folder);
            folderChanged = true;

            // Schedule the next float_folder change
            state.nextFloatFolderChangeIndex = index + ((FPS + 1) * state.rand_mult);
        }

        // Change main folder at different intervals
        if (index % (2 + FPS * state.rand_mult) === 0) {
            state.main_folder = getRandomInt(0, state.mainFolders.length - 1);
            state.rand_mult = getRandomInt(1, 9); // Update random multiplier
            console.log('Main folder changed to:', state.main_folder);
            folderChanged = true;

            // Schedule the next main_folder change
            state.nextMainFolderChangeIndex = index + (2 + FPS * state.rand_mult);
        }
    }

    // If folders changed, record the change in the scheduler
    if (folderChanged) {
        state.folderChangeSchedule.push({
            index: index, // The index at which the change occurred
            main_folder: state.main_folder,
            float_folder: state.float_folder,
        });

        // Set flag to indicate preloading is needed
        state.needsPreloading = true;
    }
}

// Function to Preload Image Pairs into the Cache
async function preloadImages(state) {
    if (state.isPreloading) return; // Prevent multiple concurrent preloads
    state.isPreloading = true;

    try {
        const preloadInfos = getPreloadIndices(state); // Get indices and their folder selections

        for (let preloadInfo of preloadInfos) {
            const { index, main_folder, float_folder } = preloadInfo;

            if (state.imageCache.has(index)) {
                // Skip if already cached
                continue;
            }

            // Determine image paths based on folder selections
            const fgFolder = state.mainFolders[main_folder];
            const bgFolder = state.floatFolders[float_folder];

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

            const fgMaxIndex = fgImages.length - 1;

            let adjustedIndex = index;

            if (adjustedIndex < 0) {
                adjustedIndex = 0;
            } else if (adjustedIndex > fgMaxIndex) {
                adjustedIndex = fgMaxIndex;
            }

            const fgIndex = adjustedIndex % fgImages.length;
            const bgIndex = adjustedIndex % bgImages.length;
            const fgPath = fgImages[fgIndex];
            const bgPath = bgImages[bgIndex];

            if (fgPath && bgPath) {
                try {
                    const [fgImg, bgImg] = await Promise.all([loadImage(fgPath), loadImage(bgPath)]);

                    if (fgImg && bgImg) {
                        state.imageCache.set(index, { fgImg, bgImg });
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
        state.isPreloading = false;
    }
}

// Function to Get Indices to Preload with Corresponding Folder Selections
function getPreloadIndices(state) {
    const indices = [];
    const bufferRange = Math.floor(BUFFER_SIZE / 2); // Adjust as needed
    const currentIndex = state.indexController.index;

    // Preload indices ahead and behind the current index
    for (let offset = -bufferRange; offset <= bufferRange; offset++) {
        let idx = currentIndex + offset;
        if (idx > state.maxIndex) idx = idx % (state.maxIndex + 1);
        if (idx < 0) idx = (state.maxIndex + 1) + idx;
        indices.push(idx);
    }

    // Determine folder selections for each index based on the scheduler
    const preloadInfo = indices.map(idx => {
        // Find the latest folder change that occurred at or before this index
        const applicableChanges = state.folderChangeSchedule.filter(change => change.index <= idx);
        const latestChange = applicableChanges.length > 0 ? applicableChanges[applicableChanges.length - 1] : null;

        if (latestChange) {
            return {
                index: idx,
                main_folder: latestChange.main_folder,
                float_folder: latestChange.float_folder,
            };
        } else {
            // Default folders if no changes have occurred yet
            return {
                index: idx,
                main_folder: state.main_folder,
                float_folder: state.float_folder,
            };
        }
    });

    return preloadInfo;
}

// Function to Get Maximum Index Based on Current Folders
function getMaxIndex(state) {
    const fgFolder = state.mainFolders[state.main_folder];
    return fgFolder.image_list.length - 1;
}

function createRenderLoop(state) {
    let lastFrameTime = 0;

    return function renderLoop(timestamp) {
        try {
            if (!lastFrameTime) lastFrameTime = timestamp;

            // Always calculate FPS
            const elapsed = timestamp - lastFrameTime;
            const { fps, frameTimes } = calculateFPS(state.frameTimes, FPS, elapsed);
            state.fps = fps;
            state.frameTimes = frameTimes;

            // Throttle rendering based on FRAME_DURATION
            if (elapsed > FRAME_DURATION) {
                console.log(`Render loop FPS: ${fps}, elapsed: ${elapsed.toFixed(2)} ms`);

                lastFrameTime = timestamp; // Reset last frame time

                const overallIndex = state.indexController.index;

                if (state.imageCache.has(overallIndex)) {
                    // Your existing rendering and folder update logic
                    changeFileSourceFolder(overallIndex, state);
                    const { fgImg, bgImg } = state.imageCache.get(overallIndex);

                    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
                    drawImageWithAspect(offscreenCtx, fgImg);
                    drawImageWithAspect(offscreenCtx, bgImg);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);

                    drawOverlayText(ctx, canvas, overallIndex, state.indexController, fgImg, bgImg, fps, state.imageCache);

                    state.indexController.increment();

                    if (state.imageCache.sizeCurrent() < BUFFER_SIZE / 2) {
                        state.needsPreloading = true;
                    }
                } else {
                    state.needsPreloading = true;
                }
            }
        } catch (error) {
            console.error('Error in renderLoop:', error);
        }

        requestAnimationFrame(renderLoop);
    };
}

// Preloading Loop Function
function startPreloadingLoop(state) {
    async function preloadingLoop() {
        if (state.needsPreloading) {
            state.needsPreloading = false; // Reset the flag
            await preloadImages(state);
        }
        // Schedule the next check
        setTimeout(preloadingLoop, 100); // Adjust the interval as needed
    }
    preloadingLoop();
}

// Function to Start the Animation
export async function startAnimation() {
    const state = startAnimation.state;

    if (state.renderLoopStarted) return;
    state.renderLoopStarted = true;

    // Initialize IndexController
    state.indexController.setIndex(0);
    state.indexController.setDirection(1);

    // Clear the cache before starting
    state.imageCache.clear();

    // Schedule initial folder changes
    state.nextResetIndex = state.indexController.index + state.rand_start;
    state.nextFloatFolderChangeIndex = state.indexController.index + ((FPS + 1) * state.rand_mult);
    state.nextMainFolderChangeIndex = state.indexController.index + (2 + FPS * state.rand_mult);

    // Preload Initial Images
    await preloadImages(state);

    // Start the Preloading Loop
    startPreloadingLoop(state);

    // Start the Rendering Loop
    const renderLoop = createRenderLoop(state);
    requestAnimationFrame(renderLoop);
}

// Function to Initialize Folders and Load Data
export async function initializeAnimation(mainData, floatData) {
    // Encapsulate index and folder related globals within a state object
    const state = {
        maxIndex: 0,
        indexController: null,
        mainFolders: [],
        floatFolders: [],
        main_folder: 0,
        float_folder: 0,
        rand_mult: getRandomInt(1, 9),
        rand_start: getRandomInt(FPS, 5 * FPS),
        frameTimes: [],
        fps: 0,
        isPreloading: false,
        folderChangeSchedule: [],
        needsPreloading: false,
        renderLoopStarted: false,
        imageCache: new ImageCache(BUFFER_SIZE),
        nextResetIndex: null,
        nextFloatFolderChangeIndex: null,
        nextMainFolderChangeIndex: null,
        lastLoggedRemainingFloatIndices: -1, // For logging optimization
        lastLoggedRemainingMainIndices: -1,  // For logging optimization
    };

    // Assign state to startAnimation for access in startAnimation
    startAnimation.state = state;

    state.mainFolders = mainData.folders;
    state.floatFolders = floatData.folders;

    // Check if folders are empty or of unequal length
    if (state.mainFolders.length === 0 || state.floatFolders.length === 0) {
        console.error('No folders found in one or both JSON files.');
        return false;
    }

    if (state.mainFolders.length !== state.floatFolders.length) {
        console.error('The number of folders in main folders and float folders do not match.');
        return false;
    }

    // Verify that each folder has an image_list
    for (let idx = 0; idx < state.mainFolders.length; idx++) {
        const folder = state.mainFolders[idx];
        if (!folder.image_list || !Array.isArray(folder.image_list) || folder.image_list.length === 0) {
            console.error(`Folder ${idx} in mainFolders is missing a valid 'image_list' array.`);
            return false;
        }
    }

    for (let idx = 0; idx < state.floatFolders.length; idx++) {
        const folder = state.floatFolders[idx];
        if (!folder.image_list || !Array.isArray(folder.image_list) || folder.image_list.length === 0) {
            console.error(`Folder ${idx} in floatFolders is missing a valid 'image_list' array.`);
            return false;
        }
    }

    state.maxIndex = getMaxIndex(state); // Now that folders are initialized
    state.indexController = new IndexController(state.maxIndex);

    // Subscribe to index changes
    state.indexController.onIndexChange((newIndex, direction, event) => {
        if (event.directionChanged) {
            // Direction changed, clear the cache
            state.imageCache.clear();
            // Clear the folder change schedule as direction change affects folder selections
            state.folderChangeSchedule = [];
            console.log('Direction changed. Cache cleared and folder change schedule reset.');

            // Set flag to initiate preloading
            state.needsPreloading = true;

            // Reschedule next folder changes based on new direction
            state.nextResetIndex = newIndex + state.rand_start;
            state.nextFloatFolderChangeIndex = newIndex + ((FPS + 1) * state.rand_mult);
            state.nextMainFolderChangeIndex = newIndex + (2 + FPS * state.rand_mult);
        }
    });

    console.log('Folders initialized successfully.');
    return true;
}
