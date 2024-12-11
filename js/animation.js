// js/animation.js

import { FRAME_DURATION } from './config.js';
import { renderImages } from './webgl.js';
import { calculateFPS } from './utils.js';

/**
 * Creates the render loop that updates and renders images based on the current frame number.
 * @param {IndexController} indexController - The IndexController instance.
 * @param {ImageCache} imageCache - The ImageCache instance.
 * @returns {function} The render loop function.
 */
function createRenderLoop(indexController, imageCache) {
    let lastFrameTime = performance.now();

    return function renderLoop(timestamp) {
        try {
            // Calculate elapsed time since last frame for FPS calculation
            const elapsed = timestamp - lastFrameTime;
            lastFrameTime = timestamp;

            // Calculate FPS
            const { fps, frameTimes } = calculateFPS(indexController.frameTimes, FRAME_DURATION, elapsed);
            indexController.fps = fps;
            indexController.frameTimes = frameTimes;

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
        } catch (error) {
            console.error('Error in renderLoop:', error);
        }

        requestAnimationFrame(renderLoop);
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
