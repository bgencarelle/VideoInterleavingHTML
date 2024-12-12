// js/imageLoaderWorker.js

/**
 * Handles messages from the main thread to load images as ImageBitmap.
 * @param {MessageEvent} event - Contains the image path, frame number, and type.
 */
self.onmessage = async (event) => {
    const { path, frameNumber, type } = event.data;

    try {
        // Construct the absolute URL based on the origin
        const fullURL = new URL(path, self.location.origin).href;
        //console.log(`[Worker] Fetching image from: ${fullURL}`);

        const response = await fetchWithRetry(fullURL, { cache: 'force-cache' }, 3, 500);
        //console.log(`[Worker] Fetch response status: ${response.status} for ${fullURL}`);

        if (!response.ok) throw new Error(`Failed to fetch image: ${fullURL} with status: ${response.status}`);

        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);
        //console.log(`[Worker] Successfully loaded ImageBitmap for frame ${frameNumber} (${type})`);

        // Post the ImageBitmap back to the main thread with type information
        self.postMessage({ frameNumber, imageBitmap, type }, [imageBitmap]);
    } catch (error) {
        console.error(`[Worker] Error loading ImageBitmap: ${path}`, error);
        self.postMessage({ frameNumber, imageBitmap: null, type });
    }
};

/**
 * Fetch with retry mechanism.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options.
 * @param {number} retries - Number of retry attempts.
 * @param {number} delay - Delay between retries in milliseconds.
 * @returns {Promise<Response>} - The fetch response.
 */
async function fetchWithRetry(url, options, retries = 3, delay = 500) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`Attempt ${attempt}: Failed to fetch ${url} with status ${response.status}`);
            return response;
        } catch (error) {
            console.warn(`[Worker] ${error.message}`);
            if (attempt < retries) {
                await new Promise(res => setTimeout(res, delay));
            } else {
                throw error;
            }
        }
    }
}
