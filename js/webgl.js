// js/webgl.js

export const canvas = document.getElementById('displayCanvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

if (!gl) {
    throw new Error("WebGL not supported");
}

// Cached variables to store DPR and canvas dimensions
let cachedDpr = 1;
let cachedCssWidth = 0;
let cachedCssHeight = 0;

// Cached image aspect ratio (set by the first image loaded)
let imageAspectRatio = null;

// Scaling factors to maintain aspect ratio
let scale = [1.0, 1.0]; // [scaleX, scaleY]

// WebGL program and buffers
let program, positionBuffer, texCoordBuffer;

// Textures for foreground and background images
let fgTexture, bgTexture;

// Initialize WebGL upon script load
initializeWebGL();

/**
 * Initializes WebGL context, shaders, buffers, and textures.
 */
export function initializeWebGL() {
    // Get device pixel ratio and window dimensions
    cachedDpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    cachedCssWidth = width;
    cachedCssHeight = height;

    // Set canvas dimensions based on DPR
    canvas.width = width * cachedDpr;
    canvas.height = height * cachedDpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Set WebGL viewport
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1); // Clear to black
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Set up shaders and buffers
    setupShaders();
    setupBuffers();

    // Set up textures
    setupTextures();

    // Initial aspect ratio scaling (will be updated after the first image is loaded)
    computeScalingFactors();

    // Handle window resize
    window.addEventListener('resize', handleResize);
}

/**
 * Sets up vertex and fragment shaders.
 */
function setupShaders() {
    const vertexShaderSource = `
        attribute vec4 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        uniform vec2 u_scale;

        void main() {
            // Apply scaling to maintain aspect ratio
            vec2 scaledPosition = a_position.xy * u_scale;
            gl_Position = vec4(scaledPosition, 0.0, 1.0);
            v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y); // Flip texture vertically
        }
    `;

    const fragmentShaderSource = `
        precision mediump float;
        uniform sampler2D u_fgImage;
        uniform sampler2D u_bgImage;
        varying vec2 v_texCoord;

        void main() {
            vec4 bgColor = texture2D(u_bgImage, v_texCoord);
            vec4 fgColor = texture2D(u_fgImage, v_texCoord);
            gl_FragColor = mix(fgColor, bgColor, bgColor.a); // Blend foreground over background
        }
    `;

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    program = createProgram(vertexShader, fragmentShader);
    gl.useProgram(program);

    // Get attribute and uniform locations
    program.a_position = gl.getAttribLocation(program, 'a_position');
    program.a_texCoord = gl.getAttribLocation(program, 'a_texCoord');
    program.u_scale = gl.getUniformLocation(program, 'u_scale');
    program.u_fgImage = gl.getUniformLocation(program, 'u_fgImage');
    program.u_bgImage = gl.getUniformLocation(program, 'u_bgImage');
}

/**
 * Compiles a shader of the given type with the provided source.
 * @param {number} type - The type of shader (VERTEX_SHADER or FRAGMENT_SHADER).
 * @param {string} source - The GLSL source code for the shader.
 * @returns {WebGLShader} The compiled shader.
 */
function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // Check for compilation errors
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Could not compile shader:\n${info}`);
    }

    return shader;
}

/**
 * Links the vertex and fragment shaders into a WebGL program.
 * @param {WebGLShader} vertexShader - The compiled vertex shader.
 * @param {WebGLShader} fragmentShader - The compiled fragment shader.
 * @returns {WebGLProgram} The linked WebGL program.
 */
function createProgram(vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // Check for linking errors
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Could not link program:\n${info}`);
    }

    return program;
}

/**
 * Sets up the position and texture coordinate buffers.
 */
function setupBuffers() {
    // Create and bind position buffer
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Two triangles forming a rectangle covering the entire clip space
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]),
        gl.STATIC_DRAW
    );

    // Create and bind texture coordinate buffer
    texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            1, 0,
        ]),
        gl.STATIC_DRAW
    );
}

/**
 * Initializes foreground and background textures with default parameters.
 */
function setupTextures() {
    // Create foreground texture
    fgTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fgTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // Flip texture vertically
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // Clamp to edge
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // Clamp to edge
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);    // Linear filtering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);    // Linear filtering
    // Initialize with a single blue pixel as a placeholder
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 5, 255]));

    // Create background texture
    bgTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // Flip texture vertically
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // Clamp to edge
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // Clamp to edge
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);    // Linear filtering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);    // Linear filtering
    // Initialize with a single blue pixel as a placeholder
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 5, 255]));
}

/**
 * Computes scaling factors based on canvas and image aspect ratios to maintain aspect ratio.
 * Should be called whenever the canvas size or image aspect ratio changes.
 */
function computeScalingFactors() {
    if (!imageAspectRatio) {
        // Default scaling if image aspect ratio is unknown
        scale = [1.0, 1.0];
        gl.uniform2fv(program.u_scale, scale);
        return;
    }

    const canvasAspect = cachedCssWidth / cachedCssHeight;

    if (canvasAspect > imageAspectRatio) {
        // Canvas is wider than image
        scale[0] = imageAspectRatio / canvasAspect; // Scale X down
        scale[1] = 1.0;                           // Y remains
    } else {
        // Canvas is taller than image
        scale[0] = 1.0;                           // X remains
        scale[1] = canvasAspect / imageAspectRatio; // Scale Y down
    }

    gl.uniform2fv(program.u_scale, scale);
}

/**
 * Handles window resize events by updating canvas size and recomputing scaling factors.
 */
function handleResize() {
    cachedDpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    cachedCssWidth = width;
    cachedCssHeight = height;

    // Update canvas dimensions
    canvas.width = width * cachedDpr;
    canvas.height = height * cachedDpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Update WebGL viewport
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Recompute scaling factors based on new canvas size
    computeScalingFactors();
}

/**
 * Renders the foreground and background images using WebGL.
 * @param {HTMLImageElement | HTMLCanvasElement | ImageBitmap} fgImg - The foreground image.
 * @param {HTMLImageElement | HTMLCanvasElement | ImageBitmap} bgImg - The background image.
 */
export function renderImages(fgImg, bgImg) {
    if (!fgImg || !bgImg) {
        console.warn("Foreground or background image is null");
        return;
    }

    // If image aspect ratio is not yet set, compute and cache it
    if (!imageAspectRatio) {
        imageAspectRatio = fgImg.width / fgImg.height;
        computeScalingFactors();
    }

    // Update foreground texture
    gl.activeTexture(gl.TEXTURE1); // Texture unit 1
    gl.bindTexture(gl.TEXTURE_2D, fgTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fgImg);

    // Update background texture
    gl.activeTexture(gl.TEXTURE0); // Texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgImg);

    // Set texture samplers
    gl.uniform1i(program.u_bgImage, 0); // Background texture unit 0
    gl.uniform1i(program.u_fgImage, 1); // Foreground texture unit 1

    // Bind position buffer and set attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(program.a_position);
    gl.vertexAttribPointer(program.a_position, 2, gl.FLOAT, false, 0, 0);

    // Bind texture coordinate buffer and set attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(program.a_texCoord);
    gl.vertexAttribPointer(program.a_texCoord, 2, gl.FLOAT, false, 0, 0);

    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the rectangle (two triangles)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
