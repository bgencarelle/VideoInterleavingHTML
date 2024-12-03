// js/animation.js

import {
    FPS, FRAME_DURATION, BUFFER_SIZE,
} from './config.js';
import {canvas, ctx, offscreenCanvas, offscreenCtx, drawImageWithAspect} from './canvas.js';
import {loadImage} from './loader.js';
import {getRandomInt} from './utils.js';

// Loaded Folder Lists
let mainFolders = [];
let floatFolders = [];

// Unified Buffer for Preloading Image Pairs
let imageBuffer = [];

// Index Variables
let overallIndex = 0; // Used for rendering
let preloadIndex = 0; // Used for preloading

// Direction Variables
let renderDirection = 1; // 1 for forward, -1 for backward
let preloadDirection = 1; // 1 for forward, -1 for backward

// Additional Variables for Folder Changes
let rand_mult = getRandomInt(1, 9);
let rand_start = Math.min(FPS + Math.max(2 * (rand_mult ** 2), 0), 255);
let float_folder = 0;
let main_folder = 0;

// Variables to Track FPS
let frameTimes = [];
let fps = 0;

// Flags
let renderLoopStarted = false;
let isPreloading = false; // Flag to prevent concurrent preloadImages calls

// Flag to Lock the Buffer During Direction Switchover
let bufferLocked = false;

// Function to Lock the Buffer
function lockBuffer() {
    bufferLocked = true;
}

// Function to Unlock the Buffer
function unlockBuffer() {
    bufferLocked = false;
}


// Function to Update Folders Based on Rules
function updateFolders(index) {

    // Reset conditions
    if ((index * renderDirection > 0 && index < rand_start) || (index * renderDirection > (10 * rand_start) && index < (12 * rand_start))) {
        float_folder = 0;
        main_folder = 0;
        console.log(float_folder, main_folder);
    }
        // Change float folder at intervals
    if (index % (FPS * rand_mult) === 0) {
            float_folder = getRandomInt(0, floatFolders.length - 1);
            rand_mult = getRandomInt(1, 12); // Update random multiplier
        //console.log('float folder_changed because ',float_folder, main_folder);

        }
        // Change main folder at different intervals
    if (index % (2 * FPS * rand_mult) === 0) {
            main_folder = getRandomInt(0, mainFolders.length - 1);
        //console.log('main folder_changed because ',float_folder, main_folder);
        }
}

// Function to Preload Image Pairs into the Buffer
async function preloadImages() {
    if (isPreloading || bufferLocked) return; // Prevent multiple concurrent preloads or preloading during lock
    isPreloading = true;
    const maxIndex = getMaxIndex(); // Cache maxIndex to avoid recalculating in each loop

    try {
        while (imageBuffer.length < BUFFER_SIZE && !bufferLocked) {
            const { fgPath, bgPath } = getImagePathsAtIndex(preloadIndex);

            if (fgPath && bgPath) {
                try {
                    // Load foreground and background images in parallel
                    const [fgImg, bgImg] = await Promise.all([loadImage(fgPath), loadImage(bgPath)]);

                    if (fgImg && bgImg) {
                        imageBuffer.push({ fgImg, bgImg, index: preloadIndex });
                    } else {
                        console.warn(`Skipping preload for invalid images at index: ${preloadIndex}`);
                    }
                } catch (imageError) {
                    console.warn(`Error loading images at index ${preloadIndex}:`, imageError);
                }
            }

            // Update preloadIndex independently
            preloadIndex += preloadDirection;
            if (preloadIndex > maxIndex) {
                preloadIndex = maxIndex;
                preloadDirection = -1; // Reverse direction
            } else if (preloadIndex < 0) {
                preloadIndex = 0;
                preloadDirection = 1; // Reverse direction
            }
        }
    } catch (error) {
        console.error('Error during image preloading:', error);
    } finally {
        isPreloading = false;
    }
}

// Function to Get Image Paths at a Specific Index
function getImagePathsAtIndex(index) {
    const fgFolder = mainFolders[main_folder];
    const bgFolder = floatFolders[float_folder];

    if (!fgFolder || !bgFolder) {
        // Folder not available
        return {fgPath: '', bgPath: ''};
    }

    if (!fgFolder.image_list || !Array.isArray(fgFolder.image_list)) {
        // Invalid image_list
        return {fgPath: '', bgPath: ''};
    }

    const fgImages = fgFolder.image_list;
    const bgImages = bgFolder.image_list;

    const fgMaxIndex = fgImages.length - 1;
    const maxIndex = fgMaxIndex;

    let idx = index;

    if (idx < 0) {
        idx = 0;
    } else if (idx > maxIndex) {
        idx = maxIndex;
    }

    const fgIndex = idx % fgImages.length;
    const bgIndex = idx % bgImages.length;
    const fgPath = fgImages[fgIndex];
    const bgPath = bgImages[bgIndex];
    return {fgPath, bgPath};
}

// Function to Get Maximum Index Based on Current Folders
function getMaxIndex() {
    const fgFolder = mainFolders[main_folder];
    return fgFolder.image_list.length - 1;
}

// Render Loop Function
let lastFrameTime = 0;

function renderLoop(timestamp) {
    try {
        // Initialize lastFrameTime during the first call
        if (!lastFrameTime) lastFrameTime = timestamp;

        const elapsed = timestamp - lastFrameTime;

        if (elapsed > FRAME_DURATION/4) {
            // Update FPS Calculation
            frameTimes.push(elapsed);
            if (frameTimes.length > FPS) frameTimes.shift();
            const averageDeltaTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
            fps = Math.round(1000 / averageDeltaTime);

            console.log(`Elapsed: ${elapsed.toFixed(2)} ms, Average Delta Time: ${averageDeltaTime.toFixed(2)} ms, FPS: ${fps}`);

            lastFrameTime = timestamp; // Reset the last frame time

            // Proceed only if the buffer has images ready
            if (imageBuffer.length > 0) {
                const { fgImg, bgImg, index } = imageBuffer.shift();

                // Update overallIndex based on the direction
                overallIndex = index;

                // Update folders based on the current index
                updateFolders(overallIndex);

                // Extract file names from paths for debugging/display (optional)
                const fgName = fgImg.src.split('/').pop();
                const bgName = bgImg.src.split('/').pop();

                // Clear and prepare the offscreen canvas
                offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
                drawImageWithAspect(offscreenCtx, fgImg); // Foreground
                drawImageWithAspect(offscreenCtx, bgImg); // Background

                // Clear and draw the main canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);

                // Draw overlay text (optional)
                ctx.font = '16px Arial';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'right';
                ctx.fillText(`Index: ${overallIndex}, Direction: ${renderDirection === 1 ? 'Forward' : 'Backward'}`, canvas.width - 10, canvas.height - 90);
                ctx.fillText(`Foreground: ${fgName}`, canvas.width - 10, canvas.height - 70);
                ctx.fillText(`Floatground: ${bgName}`, canvas.width - 10, canvas.height - 50);
                ctx.fillText(`FPS: ${fps}`, canvas.width - 10, canvas.height - 30);
                ctx.fillText(`Buffer Size: ${imageBuffer.length}`, canvas.width - 10, canvas.height - 10); // Display buffer size

                // Update overallIndex for the next frame
                overallIndex += renderDirection;

                // Handle boundary conditions for rendering index
                const maxIndex = getMaxIndex();
                if (overallIndex >= maxIndex || overallIndex <= 0) {
                    // Lock the buffer to prevent modifications during switchover
                    lockBuffer();

                    // Reverse directions
                    renderDirection *= -1;
                    preloadDirection = renderDirection;

                    // Adjust preloadIndex based on the new direction
                    preloadIndex = overallIndex + preloadDirection;

                    // Clamp preloadIndex to valid range
                    preloadIndex = Math.max(0, Math.min(preloadIndex, maxIndex));

                    // Preload images in the new direction
                    preloadImages().then(() => {
                        // Unlock the buffer after preloading
                        unlockBuffer();
                    }).catch(error => {
                        console.error('Preload Images Error during switchover:', error);
                        unlockBuffer();
                    });
                }

                // Preload more images if the buffer is running low and buffer is not locked
                if (!bufferLocked && imageBuffer.length < BUFFER_SIZE / 2) {
                    preloadImages().catch(error => console.error('Preload Images Error:', error));
                }
            } else {
                // Buffer empty: attempt to refill it if not locked
                if (!bufferLocked) {
                    preloadImages().catch(error => console.error('Preload Images Error:', error));
                }
            }
        }
    } catch (error) {
        console.error('Error in renderLoop:', error);
    }

    // Request the next frame
    requestAnimationFrame(renderLoop);
}


// Function to Start the Animation
export async function startAnimation() {
    if (renderLoopStarted) return;
    renderLoopStarted = true;

    // Reset indices and directions
    overallIndex = 0;
    preloadIndex = 0;
    renderDirection = 1;
    preloadDirection = 1;

    // Preload Initial Images
    await preloadImages();

    // Start the Rendering Loop
    requestAnimationFrame(renderLoop);
}

// Function to Initialize Folders and Load Data
export async function initializeAnimation(mainData, floatData) {
    mainFolders = mainData.folders;
    floatFolders = floatData.folders;

    // Check if folders are empty or of unequal length
    if (mainFolders.length === 0 || floatFolders.length === 0) {
        console.error('No folders found in one or both JSON files.');
        return false;
    }

    if (mainFolders.length !== floatFolders.length) {
        console.error('The number of folders in main folders and float folders do not match.');
        return false;
    }
    // Verify that each folder has an image_list
    mainFolders.forEach((folder, idx) => {
        if (!folder.image_list || !Array.isArray(folder.image_list)) {
            console.error(`Folder ${idx} in mainFolders is missing a valid 'image_list' array.`);
            return false;
        }
    });

    floatFolders.forEach((folder, idx) => {
        if (!folder.image_list || !Array.isArray(folder.image_list)) {
            console.error(`Folder ${idx} in floatFolders is missing a valid 'image_list' array.`);
            return false;
        }
    });

    return true;
}
