// js/main.js

import { initializeWebGL, canvas } from './webgl.js';
import { startAnimation } from './animation.js';
import { MAIN_IMAGES_JSON, FLOAT_IMAGES_JSON, BUFFER_SIZE } from './config.js';
import { ImageCache } from './imageCache.js';
import { IndexController } from './indexController.js';
import { FolderController } from './folderController.js';

const PRELOAD_THRESHOLD = 15; // When buffer has less than 15 frames remaining, preload more

// Preloaded JSON data
let preloadedData = {};

/**
 * Preloads JSON files into memory.
 */
async function preloadJSON() {
    try {
        const [mainResponse, floatResponse] = await Promise.all([
            fetch(MAIN_IMAGES_JSON),
            fetch(FLOAT_IMAGES_JSON)
        ]);

        if (!mainResponse.ok || !floatResponse.ok) {
            throw new Error('Failed to preload JSON files');
        }

        preloadedData.mainData = await mainResponse.json();
        preloadedData.floatData = await floatResponse.json();
    } catch (error) {
        console.error('Error preloading JSON:', error);
        preloadedData = { mainData: { folders: [] }, floatData: { folders: [] } };
    }
}

/**
 * Fetches preloaded JSON data from memory.
 * @param {string} type - Type of JSON data ('main' or 'float').
 * @returns {object} - The requested JSON data.
 */
export function fetchPreloadedJSON(type) {
    if (type === 'main') {
        return preloadedData.mainData || { folders: [] };
    } else if (type === 'float') {
        return preloadedData.floatData || { folders: [] };
    } else {
        console.error(`Unknown JSON type: ${type}`);
        return { folders: [] };
    }
}

// Initialize WebGL
initializeWebGL();

/**
 * Toggles fullscreen mode for the canvas when clicked.
 */
canvas.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        canvas.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen().catch(err => {
            console.error(`Error attempting to exit fullscreen mode: ${err.message} (${err.name})`);
        });
    }
});

/**
 * Initializes and starts the application.
 */
(async function initializeApp() {
    try {
        // Preload JSON data into memory
        await preloadJSON();

        // Retrieve preloaded data
        const mainData = fetchPreloadedJSON('main');
        const floatData = fetchPreloadedJSON('float');

        // Initialize controllers
        const indexController = new IndexController();
        const folderController = new FolderController(mainData.folders, floatData.folders);

        // Initialize IndexController with maxIndex
        const maxIndex = folderController.getMaxIndex();
        indexController.initialize(maxIndex);
        console.log(`IndexController initialized with cycleLength: ${indexController.cycleLength}`);

        // Retrieve cycleLength from IndexController
        const cycleLength = indexController.cycleLength;

        // Initialize ImageCache with cycleLength for wrap-around
        const imageCache = new ImageCache(BUFFER_SIZE, {
            cycleLength: cycleLength,
            indexController: indexController,
            folderController: folderController,
            mainFolders: mainData.folders,
            floatFolders: floatData.folders,
        });

        // Subscribe to folder changes to trigger preloading
        folderController.onFolderChange((event) => {
            if (event.folderChanged) {
                //console.log('Folder changed. Triggering preloading.');
                imageCache.preloadImages();
            }
        });

        // Subscribe to frame changes to trigger preloading when buffer is low
        indexController.onFrameChange((frameNumber) => {
            const currentFrame = frameNumber;
            const framesRemaining = imageCache.getFramesRemaining(currentFrame);

            //console.log(`Frames remaining in buffer: ${framesRemaining}`);

            if (framesRemaining < PRELOAD_THRESHOLD) {
                //console.log('Buffer running low. Triggering preloading.');
                imageCache.preloadImages();
            }
        });

        // Initialize ImageCache by preloading initial images
        await imageCache.preloadImages();

        // Start the animation
        startAnimation(indexController, imageCache);
    } catch (error) {
        console.error('Error during initialization:', error);
    }
})();
