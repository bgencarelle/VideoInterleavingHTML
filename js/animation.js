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

// Implementing a Circular Buffer for Preloading Image Pairs
class CircularBuffer {
    constructor(size) {
        this.size = size;
        this.buffer = new Array(size);
        this.head = 0;
        this.tail = 0;
        this.length = 0;
    }

    enqueue(item) {
        if (this.length === this.size) {
            console.warn('Buffer Overflow: Removing oldest item to enqueue new item.');
            this.dequeue(); // Remove oldest item
        }
        this.buffer[this.tail] = item;
        this.tail = (this.tail + 1) % this.size;
        this.length++;
    }

    dequeue() {
        if (this.length === 0) return null;
        const item = this.buffer[this.head];
        this.buffer[this.head] = undefined; // Help garbage collection
        this.head = (this.head + 1) % this.size;
        this.length--;
        return item;
    }

    isEmpty() {
        return this.length === 0;
    }

    isFull() {
        return this.length === this.size;
    }

    sizeCurrent() {
        return this.length;
    }

    clear() { // Added clear method
        this.buffer = new Array(this.size);
        this.head = 0;
        this.tail = 0;
        this.length = 0;
        console.log('Buffer cleared.');
    }
}

const imageBuffer = new CircularBuffer(BUFFER_SIZE);

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

// Flag to Lock Folder Changes During Direction Reversal
let foldersLocked = false;

// Function to Lock Folders
function lockFolders() {
    foldersLocked = true;
    console.log('Folders locked.');
}

// Function to Unlock Folders
function unlockFolders() {
    foldersLocked = false;
    console.log('Folders unlocked.');
}


// Function to Update Folders Based on Rules
function updateFolders(index) {
    if (foldersLocked) return; // Prevent folder changes during lock

    // Reset conditions based on direction
    if ((renderDirection === 1 && index < rand_start) ||
        (renderDirection === -1 && index > (10 * rand_start) && index < (12 * rand_start))) {
        float_folder = 0;
        main_folder = 0;
        console.log('Folders reset:', float_folder, main_folder);
    }

    // Change float folder at intervals
    if (index % (FPS * rand_mult) === 0 && floatFolders.length > 1) {
        float_folder = getRandomInt(0, floatFolders.length - 1);
        rand_mult = getRandomInt(1, 12); // Update random multiplier
        console.log('Float folder changed to:', float_folder);
    }

    // Change main folder at different intervals
    if (index % (2 * FPS * rand_mult) === 0 && mainFolders.length > 1) {
        main_folder = getRandomInt(0, mainFolders.length - 1);
        console.log('Main folder changed to:', main_folder);
    }
}

// Function to Preload Image Pairs into the Buffer
async function preloadImages() {
    if (isPreloading) return; // Prevent multiple concurrent preloads
    isPreloading = true;
    const maxIndex = getMaxIndex(); // Cache maxIndex to avoid recalculating in each loop

    console.log(`Preloading images: preloadIndex=${preloadIndex}, preloadDirection=${preloadDirection}`);

    try {
        while (!imageBuffer.isFull()) {
            const { fgPath, bgPath } = getImagePathsAtIndex(preloadIndex);
            console.log(`Loading images at index ${preloadIndex}: FG=${fgPath}, BG=${bgPath}`);

            if (fgPath && bgPath) {
                try {
                    // Load foreground and background images in parallel
                    const [fgImg, bgImg] = await Promise.all([loadImage(fgPath), loadImage(bgPath)]);

                    if (fgImg && bgImg) {
                        imageBuffer.enqueue({ fgImg, bgImg, index: preloadIndex });
                        console.log(`Enqueued images at index ${preloadIndex}`);
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
                console.log('Preload direction reversed to backward');
            } else if (preloadIndex < 0) {
                preloadIndex = 0;
                preloadDirection = 1; // Reverse direction
                console.log('Preload direction reversed to forward');
            }
        }
    } catch (error) {
        console.error('Error during image preloading:', error);
    } finally {
        isPreloading = false;
        console.log('Preloading completed.');
    }
}

// Function to Get Image Paths at a Specific Index
function getImagePathsAtIndex(index) {
    const fgFolder = mainFolders[main_folder];
    const bgFolder = floatFolders[float_folder];

    if (!fgFolder || !bgFolder) {
        // Folder not available
        return { fgPath: '', bgPath: '' };
    }

    if (!fgFolder.image_list || !Array.isArray(fgFolder.image_list)) {
        // Invalid image_list
        return { fgPath: '', bgPath: '' };
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
    return { fgPath, bgPath };
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

        if (elapsed > FRAME_DURATION / 4) {
            // Update FPS Calculation
            frameTimes.push(elapsed);
            if (frameTimes.length > FPS) frameTimes.shift();
            const averageDeltaTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
            fps = Math.round(1000 / averageDeltaTime);

            // Throttle console logging to once per second
            if (Math.floor(timestamp / 1000) !== Math.floor(lastFrameTime / 1000)) {
                console.log(`Elapsed: ${elapsed.toFixed(2)} ms, Average Delta Time: ${averageDeltaTime.toFixed(2)} ms, FPS: ${fps}`);
            }

            lastFrameTime = timestamp; // Reset the last frame time

            // Proceed only if the buffer has images ready
            if (!imageBuffer.isEmpty()) {
                const { fgImg, bgImg, index } = imageBuffer.dequeue();
                console.log(`Rendering frame at index ${index}`);

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
                ctx.fillText(`Buffer Size: ${imageBuffer.sizeCurrent()}`, canvas.width - 10, canvas.height - 10); // Display buffer size

                // Update overallIndex for the next frame
                overallIndex += renderDirection;

                // Handle boundary conditions for rendering index
                const maxIndex = getMaxIndex();
                if (overallIndex >= maxIndex || overallIndex <= 0) {
                    console.log(`Boundary reached at index ${overallIndex}. Reversing direction.`);
                    // Lock folders to prevent changes during switchover
                    lockFolders();

                    // Reverse directions
                    renderDirection *= -1;
                    preloadDirection = renderDirection;

                    // Clear the buffer to remove images from the previous direction
                    imageBuffer.clear();
                    console.log('Buffer cleared for direction reversal.');

                    // Adjust preloadIndex based on the new direction
                    if (renderDirection === -1) {
                        preloadIndex = maxIndex - 1;
                    } else {
                        preloadIndex = 0;
                    }

                    // Preload images in the new direction
                    preloadImages().then(() => {
                        // Unlock folders after preloading
                        console.log('Preloading completed after direction reversal.');
                        unlockFolders();
                    }).catch(error => {
                        console.error('Preload Images Error during switchover:', error);
                        unlockFolders();
                    });
                }

                // Preload more images if the buffer is running low and folders are not locked
                if (!foldersLocked && imageBuffer.sizeCurrent() < BUFFER_SIZE / 2) {
                    console.log('Buffer running low. Initiating preloading.');
                    preloadImages().catch(error => console.error('Preload Images Error:', error));
                }
            } else {
                // Buffer empty: attempt to refill it if folders are not locked
                if (!foldersLocked) {
                    console.log('Buffer empty. Initiating preloading.');
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

    // Clear the buffer before starting
    imageBuffer.clear();

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
    for (let idx = 0; idx < mainFolders.length; idx++) {
        const folder = mainFolders[idx];
        if (!folder.image_list || !Array.isArray(folder.image_list) || folder.image_list.length === 0) {
            console.error(`Folder ${idx} in mainFolders is missing a valid 'image_list' array.`);
            return false;
        }
    }

    for (let idx = 0; idx < floatFolders.length; idx++) {
        const folder = floatFolders[idx];
        if (!folder.image_list || !Array.isArray(folder.image_list) || folder.image_list.length === 0) {
            console.error(`Folder ${idx} in floatFolders is missing a valid 'image_list' array.`);
            return false;
        }
    }

    console.log('Folders initialized successfully.');
    return true;
}
