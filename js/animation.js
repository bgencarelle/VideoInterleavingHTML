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

    return function renderLoop(timestamp) {
        try {
            const elapsed = timestamp - lastFrameTime;
            if (elapsed >= frameInterval) {
                lastFrameTime = timestamp - (elapsed % frameInterval);

                indexController.update(timestamp);
                const currentFrameNumber = indexController.getCurrentFrameNumber();
                const imagePair = imageCache.get(currentFrameNumber);

                if (imagePair) {
                    const { fgImgSrc, bgImgSrc } = imagePair;
                    // Update only if needed
                    if (bgImageElement.src !== bgImgSrc) {
                        bgImageElement.src = bgImgSrc;
                    }
                    if (fgImageElement.src !== fgImgSrc) {
                        fgImageElement.src = fgImgSrc;
                    }
                }

                // Handle preloading asynchronously
                // No console logs here
                imageCache.handleFrameRender(currentFrameNumber).catch(() => {});
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
