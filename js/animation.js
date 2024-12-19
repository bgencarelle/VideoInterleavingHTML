// js/animation.js
import { FRAME_DURATION } from './config.js';

function createRenderLoop(indexController, imageCache) {
    let lastFrameTime = performance.now();
    const frameInterval = FRAME_DURATION;

    const bgImageElement = document.getElementById('bg-image');
    const fgImageElement = document.getElementById('fg-image');

    if (!bgImageElement || !fgImageElement) {
        // Minimal error handling, no repeated logging
        return () => {};
    }

    let lastRenderedFrameNumber = null; // Track the last rendered frame

    return function renderLoop(timestamp) {
        try {
            const elapsed = timestamp - lastFrameTime;
            if (elapsed >= frameInterval) {
                lastFrameTime = timestamp - (elapsed % frameInterval);

                indexController.update(timestamp);
                const currentFrameNumber = indexController.getCurrentFrameNumber();
                //console.log(`Frame updated to: ${currentFrameNumber}`);
                const imagePair = imageCache.get(currentFrameNumber);

                if (imagePair && currentFrameNumber !== lastRenderedFrameNumber) {
                    const { fgImgSrc, bgImgSrc } = imagePair;

                    bgImageElement.src = bgImgSrc;
                    fgImageElement.src = fgImgSrc;

                    lastRenderedFrameNumber = currentFrameNumber; // Update the last rendered frame
                }

                // Handle preloading asynchronously only if frame has changed
                if (currentFrameNumber !== lastRenderedFrameNumber) {
                    imageCache.handleFrameRender(currentFrameNumber).catch(() => {});
                }
            }

            requestAnimationFrame(renderLoop);
        } catch (error) {
            // Minimal logging to reduce CPU usage from console
            requestAnimationFrame(renderLoop);
        }
    };
}

export function startAnimation(indexController, imageCache) {
    if (startAnimation.renderLoopStarted) return;
    startAnimation.renderLoopStarted = true;

    const renderLoop = createRenderLoop(indexController, imageCache);
    requestAnimationFrame(renderLoop);
}
