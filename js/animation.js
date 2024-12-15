// js/animation.js

import { FRAME_DURATION } from './config.js';
import { renderImages } from './canvas.js';

/**
 * Creates the render loop that updates and renders images based on the current frame number.
 * @param {IndexController} indexController - The IndexController instance.
 * @param {ImageCache} imageCache - The ImageCache instance.
 * @returns {function} The render loop function.
 */
function createRenderLoop(indexController, imageCache) {
    let lastFrameTime = performance.now();
    const desiredFPS = 60; // Adjust as needed
    const frameInterval = 1000 / desiredFPS;

    return function renderLoop(timestamp) {
        try {
            const elapsed = timestamp - lastFrameTime;

            if (elapsed >= frameInterval) {
                lastFrameTime = timestamp - (elapsed % frameInterval); // Adjust for any lag

                // Update the frame number based on current timestamp
                indexController.update(timestamp);

                const currentFrameNumber = indexController.getCurrentFrameNumber();

                // Fetch the latest image from the buffer
                const imagePair = imageCache.get(currentFrameNumber);

                if (imagePair) {
                    const { fgImg, bgImg } = imagePair;

                    // Render images
                    renderImages(fgImg, bgImg);
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
