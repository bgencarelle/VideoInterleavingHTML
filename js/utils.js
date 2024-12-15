// utils.js

let overlayTimeout = null;

export function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Displays an overlay message on the screen.
 * @param {string} message - The message to display.
 * @param {string} position - The position of the overlay ('top-right' or 'bottom-right').
 */
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
        overlay.style.top = 'auto'; // Override top if previously set
    } else {
        // Default to top-right
        overlay.style.top = '10px';
        overlay.style.right = '10px';
        overlay.style.bottom = 'auto'; // Override bottom if previously set
    }

    overlay.textContent = message;
    overlay.style.opacity = '1';

    // Clear previous timeout if any
    if (overlayTimeout) clearTimeout(overlayTimeout);

    // Set a timeout to fade out after 1 second
    overlayTimeout = setTimeout(() => {
        overlay.style.opacity = '0';
    }, 1000);
}
