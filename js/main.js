// js/main.js

import { initializeCanvas, canvas } from './canvas.js';
import { initializeAnimation, startAnimation } from './animation.js';
import { MAIN_IMAGES_JSON, FLOAT_IMAGES_JSON } from './config.js';

// Preloaded JSON data (loaded into memory)
let preloadedData = {};

// Preload JSON files into memory
async function preloadJSON() {
    try {
        const mainResponse = await fetch(MAIN_IMAGES_JSON);
        const floatResponse = await fetch(FLOAT_IMAGES_JSON);

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

// Fetch JSON data from memory (instead of from disk)
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

// Initialize canvas
initializeCanvas();

/**
 * Toggles fullscreen mode for the canvas when clicked.
 */
canvas.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        canvas.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
});

// Start the application within an async IIFE to allow await
(async function initializeApp() {
    try {
        // Preload JSON data into memory
        await preloadJSON();

        // Retrieve preloaded data
        const mainData = fetchPreloadedJSON('main');
        const floatData = fetchPreloadedJSON('float');

        // Initialize animation with loaded data
        const success = await initializeAnimation(mainData, floatData);
        console.log('Initialization success:', success);

        if (success) {
            // Start the animation directly
            startAnimation();
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }
})();
