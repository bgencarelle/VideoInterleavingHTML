// js/main.js

import {initializeCanvas, canvas} from './canvas.js';
import {fetchJSON} from './loader.js';
import {initializeAnimation, startAnimation} from './animation.js';
import {MAIN_IMAGES_JSON, FLOAT_IMAGES_JSON} from './config.js';

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
        // Load Folder Lists
        const mainData = await fetchJSON(MAIN_IMAGES_JSON);
        const floatData = await fetchJSON(FLOAT_IMAGES_JSON);

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
