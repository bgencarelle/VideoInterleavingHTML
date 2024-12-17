// js/animation.js

import { FRAME_DURATION } from './config.js';
// Removed import for renderImages as we're using CSS-based layering

/**
 * Creates the render loop that updates and renders images based on the current frame number.
 * @param {IndexController} indexController - The IndexController instance.
 * @param {ImageCache} imageCache - The ImageCache instance.
 * @returns {function} The render loop function.
 */
function createRenderLoop(indexController, imageCache) {
    let lastFrameTime = performance.now();
    const frameInterval = FRAME_DURATION;

    // Get references to the image elements
    const bgImageElement = document.getElementById('bg-image');
    const fgImageElement = document.getElementById('fg-image');

    if (!bgImageElement || !fgImageElement) {
        console.error('Image elements #bg-image and/or #fg-image not found in the DOM.');
        return () => {}; // Return an empty function to prevent errors
    }

    return function renderLoop(timestamp) {
        try {
            const elapsed = timestamp - lastFrameTime;

            if (elapsed >= frameInterval) {
                lastFrameTime = timestamp - (elapsed % frameInterval); // Adjust for any lag

                // Update the frame number based on current timestamp
                indexController.update(timestamp);

                const currentFrameNumber = indexController.getCurrentFrameNumber();

                // Fetch the latest image from the cache
                const imagePair = imageCache.get(currentFrameNumber);
                //console.log(`Frame ${currentFrameNumber} image pair:`, imagePair);

                if (imagePair) {
                    const { fgImgSrc, bgImgSrc } = imagePair;

                    // Update background image if the source has changed
                    if (bgImageElement.src !== bgImgSrc) {
                        bgImageElement.src = bgImgSrc;
                    }

                    // Update foreground image if the source has changed
                    if (fgImageElement.src !== fgImgSrc) {
                        fgImageElement.src = fgImgSrc;
                    }
                } else {
                    console.warn(`No image available for frame ${currentFrameNumber}`);
                }


                // Notify ImageCache that the current frame has been rendered
                imageCache.handleFrameRender(currentFrameNumber).catch(error => {
                    console.error('Error in handleFrameRender:', error);
                });
            }

            requestAnimationFrame(renderLoop);
        } catch (error) {
            console.error('Error in renderLoop:', error);
            requestAnimationFrame(renderLoop); // Ensure the loop continues even after an error
        }
    };
}

/**
 * Starts the animation by initiating the render loop.
 * @param {IndexController} indexController - The IndexController instance.
 * @param {ImageCache} imageCache - The ImageCache instance.
 */
export function startAnimation(indexController, imageCache) {
    if (startAnimation.renderLoopStarted) return;
    startAnimation.renderLoopStarted = true;

    // Start the Rendering Loop
    const renderLoop = createRenderLoop(indexController, imageCache);
    requestAnimationFrame(renderLoop);
}

