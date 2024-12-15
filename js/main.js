// js/main.js

import { canvas, initializeCanvas2D } from './canvas.js';
import { startAnimation } from './animation.js';
import { BUFFER_SIZE, MAX_CONCURRENT_FETCHES, FLOAT_IMAGES_JSON, MAIN_IMAGES_JSON } from './config.js';
import { ImageCache } from './imageCache.js';
import { IndexController } from './indexController.js';
import { FolderController } from './folderController.js';
import { showModeOverlay } from './utils.js'; // Imported showModeOverlay

/**
 * Preloaded JSON data
 */
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
        initializeCanvas2D();
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

        // Initialize ImageCache by preloading initial images
        await imageCache.preloadImages(indexController.getCurrentFrameNumber());

        // Start the animation
        startAnimation(indexController, imageCache);

        // Pause state flag
        let paused = false;

        // Scheduling state for L key
        let isLScheduling = false;

        // Keyboard event listener
        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (key === 'p') {
                // Toggle pause/unpause
                if (!paused) {
                    indexController.pause();
                    paused = true;
                    showModeOverlay('Paused');
                } else {
                    indexController.unpause();
                    paused = false;
                    showModeOverlay('Unpaused');
                }
            } else if (key === 's') {
                // Display "Restart" in bottom-right corner
                showModeOverlay('Restart', 'bottom-right');

                // Reset the index to 0 and reset the time
                indexController.reset();

            } else if (key === 'l') {
                if (!isLScheduling) {
                    // Start scheduling pause + reset after 2 cycles
                    indexController.schedulePauseAfterCycles(2);
                    isLScheduling = true;
                    showModeOverlay('Scheduling Pause & Reset after 2 cycles', 'bottom-right');
                } else {
                    // Cancel any scheduled pause + reset
                    indexController.cancelScheduledPause();
                    isLScheduling = false;
                    showModeOverlay('Cancelled Scheduled Pause & Reset', 'bottom-right');
                }
            }
        });

        // Listen to IndexController events for better user feedback
        indexController.onFrameChange((frameNumber, event) => {
            if (event.cycleCompleted) {
                // Display current cycle number
                showModeOverlay(`CYCLE #${event.cycleNumber}`, 'bottom-right');
            }
            if (event.schedulingPause) {
                showModeOverlay(`Pause & Reset scheduled after ${event.cycles} cycles`, 'bottom-right');
            }
            if (event.cancelScheduledPause) {
                showModeOverlay('Scheduled Pause & Reset cancelled', 'bottom-right');
            }
            if (event.scheduledPause) {
                showModeOverlay('Paused and Reset', 'bottom-right');
                paused = true; // Since controller is paused
                isLScheduling = false; // Reset scheduling flag
            }
            if (event.paused) {
                // Additional handling if needed
            }
            if (event.unpaused) {
                // Additional handling if needed
            }
            if (event.reset) {
                // Additional handling if needed
            }
        });

        // Optional: Handle fullscreen change to ensure overlay is appended correctly
        document.addEventListener('fullscreenchange', () => {
            // Reposition the overlay if needed
            // For this implementation, the overlay function handles dynamic parent selection
        });

    } catch (error) {
        console.error('Error during initialization:', error);
    }
})();
