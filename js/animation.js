// js/animation.js

import {
    FPS,
    FRAME_DURATION,
    BUFFER_SIZE,
    MAX_CONCURRENT_FETCHES,
} from './config.js';
import { renderImages } from './canvas.js';
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
    let lastFrameTime = performance.now();
    state.indexController.startTime = lastFrameTime; // Initialize startTime

    return function renderLoop(timestamp) {
        try {
            // Calculate elapsed time since last frame for FPS calculation
            const elapsed = timestamp - lastFrameTime;
            lastFrameTime = timestamp;

            const { fps, frameTimes } = calculateFPS(state.frameTimes, FPS, elapsed);
            state.fps = fps;
            state.frameTimes = frameTimes;

            // Update the index based on current timestamp
            state.indexController.update(timestamp, state.maxIndex);

            const overallIndex = state.indexController.index;
            const currentDirection = state.indexController.direction;

            if (state.imageCache.has(overallIndex)) {
                const { fgImg, bgImg } = state.imageCache.get(overallIndex);

                // Render images
                renderImages(fgImg, bgImg);

                // Update folders based on current index and direction
                state.folderController.updateFolders(overallIndex, currentDirection);
            } else {
                console.warn(`Image at index ${overallIndex} not in cache.`);
                state.needsPreloading = true; // Trigger preloading if image is missing
            }

            // Schedule buffer preloading if cache size is below BUFFER_SIZE / 2
            if (state.imageCache.size() < BUFFER_SIZE / 2) {
                state.needsPreloading = true;
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
    if (state.preloadingLoopRunning) return; // Prevent multiple loops
    state.preloadingLoopRunning = true;

    async function preloadingLoop() {
        try {
            if (state.needsPreloading) {
                console.log('Preloading needed. Starting preloading...');
                state.needsPreloading = false; // Reset the flag
                await state.imageCache.preloadImages(); // Preload based on current direction and index
            }
        } catch (error) {
            console.error('Error in preloadingLoop:', error);
        } finally {
            // Schedule the next check
            setTimeout(preloadingLoop, 50); // Adjust the interval as needed
        }
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
    state.maxIndex = state.folderController.getMaxIndex();
    state.indexController.setIndex(0, state.maxIndex);
    state.indexController.setDirection(1);

    // Clear the cache before starting
    state.imageCache.clear();

    // Preload Initial Images
    await state.imageCache.preloadImages(); // Preload based on initial direction

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
        preloadingLoopRunning: false, // New flag for preloading loop
        imageCache: null, // Will be initialized below
        maxIndex: 0,
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
            console.log('Folder changed. Needs preloading.');
        }
    });

    // Subscribe to index changes, particularly direction changes
    state.indexController.onIndexChange((newIndex, direction, event) => {
        if (event.directionChanged) {
            // Direction changed, clear the cache
            state.imageCache.clear();
            console.log('Direction changed. Cache cleared.');

            // Set flag to initiate preloading based on new direction
            state.needsPreloading = true;
        }
    });

    console.log('Folders initialized successfully.');
    return true;
}
