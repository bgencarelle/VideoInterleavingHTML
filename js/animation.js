// js/animation.js

import {
    FPS, FRAME_DURATION, BUFFER_SIZE,
} from './config.js';
import { canvas, ctx, renderImages } from './canvas.js';
import { IndexController } from './indexController.js';
import { FolderController } from './folderController.js';
import { drawOverlayText, calculateFPS } from './utils.js';
import { ImageCache } from './imageCache.js';

/**
 * Factory function to create the render loop.
 * @param {object} state - The state object containing necessary properties.
 * @returns {function} The render loop function.
 */
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
            if (elapsed >= FRAME_DURATION) {
                // console.log(`Render loop FPS: ${fps}, elapsed: ${elapsed.toFixed(2)} ms`);

                lastFrameTime = timestamp; // Reset last frame time

                const overallIndex = state.indexController.index;

                if (state.imageCache.has(overallIndex)) {
                    const { fgImg, bgImg } = state.imageCache.get(overallIndex);

                    // Use the centralized renderImages function
                    renderImages(fgImg, bgImg);

                    // Optionally, draw overlay text
                    // drawOverlayText(ctx, canvas, overallIndex, state.indexController, fgImg, bgImg, fps, state.imageCache);

                    // Update folders based on current index and direction
                    state.folderController.updateFolders(overallIndex, state.indexController.direction);

                    // Get maxIndex from FolderController
                    const maxIndex = state.folderController.getMaxIndex();

                    // Increment the index
                    state.indexController.increment(maxIndex);

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

/**
 * Starts the preloading loop to continuously check and preload images.
 * @param {object} state - The state object containing necessary properties.
 */
function startPreloadingLoop(state) {
    async function preloadingLoop() {
        if (state.needsPreloading) {
            state.needsPreloading = false; // Reset the flag
            await state.imageCache.preloadImages(); // Use preloadImages from ImageCache
        }
        // Schedule the next check
        setTimeout(preloadingLoop, 100); // Adjust the interval as needed
    }
    preloadingLoop();
}

/**
 * Starts the animation by initializing necessary components and starting loops.
 */
export async function startAnimation() {
    const state = startAnimation.state;

    if (state.renderLoopStarted) return;
    state.renderLoopStarted = true;

    // Initialize IndexController
    const maxIndex = state.folderController.getMaxIndex();
    state.indexController.setIndex(0, maxIndex);
    state.indexController.setDirection(1);

    // Clear the cache before starting
    state.imageCache.clear();

    // Preload Initial Images
    await state.imageCache.preloadImages(); // Use preloadImages from ImageCache

    // Start the Preloading Loop
    startPreloadingLoop(state);

    // Start the Rendering Loop
    const renderLoop = createRenderLoop(state);
    requestAnimationFrame(renderLoop);
}

/**
 * Initializes folders and loads data into the animation state.
 * @param {object} mainData - The main folder data.
 * @param {object} floatData - The float folder data.
 * @returns {boolean} Returns true if initialization is successful, false otherwise.
 */
export async function initializeAnimation(mainData, floatData) {
    // Encapsulate index and folder related globals within a state object
    const state = {
        indexController: null,
        folderController: null,
        mainFolders: [],
        floatFolders: [],
        frameTimes: [],
        fps: 0,
        needsPreloading: false,
        renderLoopStarted: false,
        imageCache: null, // Will be initialized below
    };

    // Assign state to startAnimation for access in startAnimation
    startAnimation.state = state;

    state.mainFolders = mainData.folders;
    state.floatFolders = floatData.folders;

    // Check if folders are empty
    if (state.mainFolders.length === 0 || state.floatFolders.length === 0) {
        console.error('No folders found in one or both JSON files.');
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

    // Create FolderController
    state.folderController = new FolderController(state.mainFolders, state.floatFolders);

    // Create IndexController
    state.indexController = new IndexController();

    // Initialize the image cache with the specified BUFFER_SIZE and options
    state.imageCache = new ImageCache(BUFFER_SIZE, {
        indexController: state.indexController,
        folderController: state.folderController,
        mainFolders: state.mainFolders,
        floatFolders: state.floatFolders,
    });

    // Subscribe to folder changes
    state.folderController.onFolderChange((event) => {
        if (event.folderChanged) {
            // Folders changed, set flag to initiate preloading
            state.needsPreloading = true;
        }
    });

    // Subscribe to index changes
    state.indexController.onIndexChange((newIndex, direction, event) => {
        if (event.directionChanged) {
            // Direction changed, clear the cache
            state.imageCache.clear();
            console.log('Direction changed. Cache cleared.');

            // Set flag to initiate preloading
            state.needsPreloading = true;
        }
    });

    console.log('Folders initialized successfully.');
    return true;
}
