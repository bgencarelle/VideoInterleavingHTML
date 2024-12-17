// config.js

export const FPS = 60; // Frames Per Second for canvas
export const IPS = 30; //Index Updates Per Second
export const FRAME_DURATION = 1000 / FPS;
export const BUFFER_SIZE = FPS; // Example: buffer size equals one second of frames
export const MAX_CONCURRENT_FETCHES = 5; // Maximum number of concurrent image preloads
export const PINGPONG_MODE = true;
export const MAIN_IMAGES_JSON = 'generated_img_lists/main_images.json';
export const FLOAT_IMAGES_JSON = 'generated_img_lists/float_images.json';
