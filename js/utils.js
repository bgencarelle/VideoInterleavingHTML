// js/utils.js

import { FLOAT_IMAGES_JSON, MAIN_IMAGES_JSON } from './config.js';

let overlayTimeout = null;

export function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function showModeOverlay(message, position = 'top-right') {
    let overlay = document.getElementById('mode-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mode-overlay';
        overlay.style.position = 'fixed';
        overlay.style.background = 'rgba(0,0,0,0.7)';
        overlay.style.color = '#fff';
        overlay.style.padding = '5px 10px';
        overlay.style.borderRadius = '4px';
        overlay.style.fontFamily = 'sans-serif';
        overlay.style.fontSize = '30px';
        overlay.style.transition = 'opacity 0.5s';
        overlay.style.opacity = '1';
        document.body.appendChild(overlay);
    }

    // Set position based on the 'position' parameter
    if (position === 'bottom-right') {
        overlay.style.bottom = '10px';
        overlay.style.right = '10px';
        overlay.style.top = 'auto';
    } else {
        overlay.style.top = '10px';
        overlay.style.right = '10px';
        overlay.style.bottom = 'auto';
    }

    overlay.textContent = message;
    overlay.style.opacity = '1';

    if (overlayTimeout) clearTimeout(overlayTimeout);

    overlayTimeout = setTimeout(() => {
        overlay.style.opacity = '0';
    }, 1000);
}

/**
 * Adds keyboard event listeners for controlling the application.
 * @param {Object} indexController - The IndexController instance.
 * @param {Function} showModeOverlay - Function to display mode overlay.
 */
export function addKeyboardListeners(indexController, showModeOverlay) {
    let paused = false;

    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (key === 'p') {
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
            showModeOverlay('Restart', 'bottom-right');
            indexController.reset();
        }
    });
}

/**
 * Adds fullscreen toggle to a specified element.
 * @param {HTMLElement} element - The target element for fullscreen toggle.
 */
export function addFullscreenToggle(element) {
    if (element) {
        element.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                element.requestFullscreen().catch(err => {
                    console.error(`Error enabling fullscreen: ${err.message}`);
                });
            } else {
                document.exitFullscreen().catch(err => {
                    console.error(`Error exiting fullscreen: ${err.message}`);
                });
            }
        });
    } else {
        console.error('Target element not found for fullscreen toggle.');
    }
}

/**
 * Preloaded JSON data
 */
let preloadedData = {};

/**
 * Preloads JSON files into memory.
 */
// Fallback preloadedData constant
const DEFAULT_PRELOADED_DATA = {
    mainData: { folders: [] },
    floatData: { folders: [] },
};

export async function preloadJSON() {
    try {
        const mainFetch = fetch(MAIN_IMAGES_JSON);
        const floatFetch = fetch(FLOAT_IMAGES_JSON);

        const [mainResponse, floatResponse] = await Promise.all([mainFetch, floatFetch]);

        if (!mainResponse.ok || !floatResponse.ok) {
            throw new Error('Failed to preload JSON files');
        }

        preloadedData.mainData = await mainResponse.json();
        preloadedData.floatData = await floatResponse.json();
    } catch (error) {
        handlePreloadError(error);
    }
}

/**
 * Handles errors during preloading, logs the error, and assigns default data.
 * @param {Error} error - The error object caught during preloading.
 */
function handlePreloadError(error) {
    console.error('Error preloading JSON:', error);
    preloadedData = { ...DEFAULT_PRELOADED_DATA };
}

/**
 * Fetches preloaded JSON data based on type.
 * @param {string} type - The type of JSON data ('main' or 'float').
 * @returns {Object} - The requested JSON data.
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
 * Sets up keyboard callbacks for mode changes and external folder adjustments.
 * @param {FolderController} controller - The FolderController instance.
 * @returns {Function} - The bound keydown handler for cleanup.
 */
export function setupKeyboardCallbacksFolder(controller) {
    const boundKeydownHandler = (e) => {
        const key = e.key.toLowerCase();
        if (key === 'r') { controller.setMode('RANDOM'); return; }
        if (key === 'i') { controller.setMode('INCREMENT'); return; }
        if (key === 'e') { controller.setMode('EXTERNAL'); return; }

        if (controller.mode === 'EXTERNAL') {
            let mainDelta = 0;
            let floatDelta = 0;

            switch (key) {
                case '1': mainDelta = 1; break;
                case '2': mainDelta = -1; break;
                case '3': floatDelta = 1; break;
                case '4': floatDelta = -1; break;
                default: return;
            }

            controller.queueExternalChange({ mainDelta, floatDelta });
        }
    };

    document.addEventListener('keydown', boundKeydownHandler);
    return () => {
        document.removeEventListener('keydown', boundKeydownHandler);
    };
}
