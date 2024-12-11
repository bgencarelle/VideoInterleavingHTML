export const canvas = document.getElementById('displayCanvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

if (!gl) {
    throw new Error("WebGL not supported");
}

let cachedDpr = 1;
let cachedCssWidth = 0;
let cachedCssHeight = 0;
let aspectRatioMatrix = null;
let program, positionBuffer, texCoordBuffer;

// Initialize WebGL
export function initializeWebGL() {
    cachedDpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    cachedCssWidth = width;
    cachedCssHeight = height;

    canvas.width = width * cachedDpr;
    canvas.height = height * cachedDpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    setupShaders();
    setupBuffers();
    aspectRatioMatrix = calculateAspectRatioMatrix();
}

// Calculate Aspect Ratio Matrix
function calculateAspectRatioMatrix() {
    const canvasAspect = cachedCssWidth / cachedCssHeight;
    return canvasAspect >= 1
        ? [1 / canvasAspect, 1]
        : [1, canvasAspect];
}

// Set up shaders
function setupShaders() {
    const vertexShaderSource = `
        attribute vec4 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        uniform vec2 u_aspect;

        void main() {
            vec2 scaledPosition = a_position.xy * u_aspect;
            gl_Position = vec4(scaledPosition, 0, 1);
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
            gl_FragColor = mix(bgColor, fgColor, fgColor.a); // Blend fg over bg
        }
    `;

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    program = createProgram(vertexShader, fragmentShader);
    gl.useProgram(program);

    program.a_position = gl.getAttribLocation(program, 'a_position');
    program.a_texCoord = gl.getAttribLocation(program, 'a_texCoord');
    program.u_aspect = gl.getUniformLocation(program, 'u_aspect');
    program.u_fgImage = gl.getUniformLocation(program, 'u_fgImage');
    program.u_bgImage = gl.getUniformLocation(program, 'u_bgImage');
}

// Create shaders
function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

// Create program
function createProgram(vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
}

// Set up buffers
function setupBuffers() {
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            -1, -1, 1, -1,
            -1, 1, 1, 1,
        ]),
        gl.STATIC_DRAW
    );

    texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            0, 0, 1, 0,
            0, 1, 1, 1,
        ]),
        gl.STATIC_DRAW
    );
}

// Render images
export function renderImages(fgImg, bgImg) {
    const fgTexture = createTexture(fgImg);
    const bgTexture = createTexture(bgImg);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2fv(program.u_aspect, aspectRatioMatrix);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.uniform1i(program.u_bgImage, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fgTexture);
    gl.uniform1i(program.u_fgImage, 1);

    gl.enableVertexAttribArray(program.a_position);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(program.a_position, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(program.a_texCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(program.a_texCoord, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Create texture
function createTexture(image) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // Flip texture vertically
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return texture;
}

// Handle window resize
window.addEventListener('resize', () => {
    initializeWebGL();
});
