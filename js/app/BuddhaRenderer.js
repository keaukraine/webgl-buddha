'use strict';

define([
    'framework/BaseRenderer',
    'DiffuseShader',
    'LightShaftShader',
    'SphericalMapLMShader',
    'LMTableShader',
    'PointSpriteScaledColoredShader',
    'framework/utils/MatrixUtils',
    'framework/FullModel',
    'framework/UncompressedTextureLoader',
    'framework/CompressedTextureLoader',
    'framework/FrameBuffer',
    'framework/TextureUtils',
    'SoftDiffuseColoredShader'
],
    function (
        BaseRenderer,
        DiffuseShader,
        LightShaftShader,
        SphericalMapLMShader,
        LMTableShader,
        PointSpriteScaledColoredShader,
        MatrixUtils,
        FullModel,
        UncompressedTextureLoader,
        CompressedTextureLoader,
        FrameBuffer,
        TextureUtils,
        SoftDiffuseColoredShader
    ) {
        class BuddhaRenderer extends BaseRenderer {
            constructor() {
                super();

                this.loadedItemsCount = 0; // counter of loaded OpenGL buffers+textures
                this.loaded = false; // won't draw until this is true

                this.angleYaw = 0; // camera rotation angle
                this.lastTime = 0; // used for animating camera

                this.ITEMS_TO_LOAD = 15; // total number of OpenGL buffers+textures to load
                this.FLOAT_SIZE_BYTES = 4; // float size, used to calculate stride sizes
                this.TRIANGLE_VERTICES_DATA_STRIDE_BYTES = 5 * this.FLOAT_SIZE_BYTES;
                this.TRIANGLE_VERTICES_DATA_POS_OFFSET = 0;
                this.TRIANGLE_VERTICES_DATA_UV_OFFSET = 3;
                this.FOV_LANDSCAPE = 25.0; // FOV for landscape
                this.FOV_PORTRAIT = 40.0; // FOV for portrait
                this.YAW_COEFF_NORMAL = 80.0; // camera rotation speed

                this.SCENE_SIZE = { x: 350, y: 350, z: 200 };
                this.DUST_SPEED = 350000 * 60;
                this.DUST_FLICKER_SPEED = 10000;
                this.DUST_COUNT = 8;
                this.DUST_OFFSET_Z = 200;
                this.DUST_COLOR = { r: 20 / 256, g: 18 / 256, b: 15 / 256, a: 1 };
                this.DUST_SPRITE_SIZE = 0.015;
                this.DUST_SCALE = 0.75;

                this.timerDustRotation = 0;
                this.timerDustFlicker = 0;
                this.timerSmokeRotation = 0;
                this.dustSpriteSize = 0;

                this.Z_NEAR = 100;
                this.Z_FAR = 2000;
                this.SMOKE_SOFTNESS = 0.08;
                this.m_smokeCoordinates = [
                    [-219.188324, -77.765877, -32.000130],
                    [-164.917282, -155.531754, -3.268164],
                    [-74.093452, -109.379417, -100.979820],
                    [-54.972435, -218.313690, -125.006828],
                    [68.940094, -109.379417, -57.751869],
                    [54.972427, -218.313690, -46.009144],
                    [209.912292, -77.765877, -144.106689],
                    [164.917282, -155.531754, 37.452091],
                    [-237.278671, -0.000009, 63.925690],
                    [224.910599, -0.000009, 69.076576],
                    [-219.188324, 77.765869, -143.545853],
                    [-74.093452, 107.153793, -18.438652],
                    [68.940109, 107.153816, 9.984768],
                    [209.912292, 77.765869, -87.094765],
                    [-164.917297, 155.531754, -42.647652],
                    [-54.972443, 214.752686, 36.233562],
                    [54.972427, 214.752686, 29.778637],
                    [164.917282, 155.531754, -194.976959],
                ];
                this.SMOKE_COLOR = {
                    r: 75 / 255,
                    g: 76 / 255,
                    b: 92 / 255
                };
                this.SMOKE_SPEED = 90333;

                this.mOrthoMatrix = new Array(16);
                MatrixUtils.mat4.ortho(this.mOrthoMatrix, -1, 1, -1, 1, 2.0, 250);
            }

            initVignette() {
                this.mQuadTriangles = new Float32Array([
                    // X, Y, Z, U, V
                    -1.0, -1.0, -5.0, 0.0, 0.0, // 0. left-bottom
                    1.0, -1.0, -5.0, 1.0, 0.0, // 1. right-bottom
                    -1.0, 1.0, -5.0, 0.0, 1.0, // 2. left-top
                    1.0, 1.0, -5.0, 1.0, 1.0, // 3. right-top
                ]);
                this.mTriangleVerticesVignette = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, this.mTriangleVerticesVignette);
                gl.bufferData(gl.ARRAY_BUFFER, this.mQuadTriangles, gl.STATIC_DRAW);
            }

            resizeCanvas() {
                super.resizeCanvas();

                this.dustSpriteSize = Math.min(this.canvas.height, this.canvas.width) * this.DUST_SPRITE_SIZE;
            }

            /**
             * Resets loaded state for renderer
             */
            resetLoaded() {
                this.loaded = false;
                this.loadedItemsCount = 0;
            }

            onBeforeInit() {
                super.onBeforeInit();

                document.getElementById('canvasGL').classList.remove('hidden');
            }

            onInitError() {
                super.onInitError();

                $(canvas).hide();
                document.getElementById('alertError').classList.remove('hidden');
            }

            initShaders() {
                this.shaderSphericalMapLM = new SphericalMapLMShader();
                this.shaderLMTable = new LMTableShader();
                this.shaderDiffuse = new DiffuseShader();
                this.shaderShaft = new LightShaftShader();
                this.shaderPointSpriteScaledColored = new PointSpriteScaledColoredShader();
                this.shaderSoftDiffuseColored = new SoftDiffuseColoredShader();
            }

            /**
             * Callback for all loading function. Updates loading progress and allows rendering after loading all stuff
             */
            updateLoadedObjectsCount() {
                var percent,
                    progressElement = document.getElementById('progressLoading');

                this.loadedItemsCount++; // increase loaded objects counter

                percent = Math.floor(this.loadedItemsCount * 100 / this.ITEMS_TO_LOAD) + '%';
                progressElement.innerHTML = percent;
                progressElement.style.width = percent;

                if (this.loadedItemsCount >= this.ITEMS_TO_LOAD) {
                    this.loaded = true; // allow rendering
                    console.log('Loaded all assets');
                    document.getElementById('divControls').classList.add('transparent');
                    setTimeout(() => document.getElementById('divControls').classList.add('hidden'), 1000);
                    setTimeout(() => document.querySelector('.control-icon').classList.remove('transparent'), 1200);
                    setTimeout(() => document.querySelector('.promo').classList.remove('transparent'), 1800);
                }
            }

            /**
             * loads all WebGL buffers and textures. Uses updateLoadedObjectsCount() callback to indicate that data is loaded to GPU
             */
            loadData() {
                this.initVignette();

                var boundUpdateCallback = this.updateLoadedObjectsCount.bind(this);

                this.textureBuddhaNormalMap = UncompressedTextureLoader.load('data/textures/buddha-normals.png', boundUpdateCallback);
                this.textureSphericalMap = UncompressedTextureLoader.load('data/textures/sphere_gold3.png', boundUpdateCallback);
                this.textureBuddhaLightMap = UncompressedTextureLoader.load('data/textures/buddha_lm.png', boundUpdateCallback);
                this.textureTable = this.loadETC1WithFallback('data/textures/table/marble');
                this.textureTableLM = UncompressedTextureLoader.load('data/textures/table/table_lm.png', boundUpdateCallback);
                this.textureSky = UncompressedTextureLoader.load('data/textures/sky/sky1.png', boundUpdateCallback);
                this.textureShaft = UncompressedTextureLoader.load('data/textures/shafts.png', boundUpdateCallback);
                this.textureSmoke = UncompressedTextureLoader.load('data/textures/smoke.png', boundUpdateCallback);

                this.modelTable = new FullModel();
                this.modelTable.load('data/models/table', boundUpdateCallback);
                this.modelBuddha = new FullModel();
                this.modelBuddha.load('data/models/buddha', boundUpdateCallback);

                this.fmSky = new FullModel();
                this.fmSky.load('data/models/sky', boundUpdateCallback);

                this.fmShaft = new FullModel();
                this.fmShaft.load('data/models/shafts', boundUpdateCallback);

                this.fmDustPatch = new FullModel();
                this.fmDustPatch.load('data/models/particles_20', boundUpdateCallback);
                this.textureDust = UncompressedTextureLoader.load('data/textures/dust.png', boundUpdateCallback);

                this.fmQuad = new FullModel();
                this.fmQuad.load('data/models/smoke100', boundUpdateCallback);

                this.fillParticles();

                this.initOffscreen();
            }

            fillParticles() {
                this.dustCoordinates = [];

                for (let i = 0; i < this.DUST_COUNT; i++) {
                    this.dustCoordinates[i] = {
                        x: (0.5 - Math.random()) * this.SCENE_SIZE.x,
                        y: (0.5 - Math.random()) * this.SCENE_SIZE.y,
                        z: (0.5 - Math.random()) * this.SCENE_SIZE.z + this.DUST_OFFSET_Z
                    };
                }
            }

            initOffscreen() {
                this.textureOffscreenColorID = TextureUtils.createNPOTTexture(this.canvas.width, this.canvas.height, false);
                this.checkGlError("color");
                this.textureOffscreenDepthID = TextureUtils.createDepthTexture(this.canvas.width, this.canvas.height);
                this.checkGlError("depth");
                this.fboOffscreen = new FrameBuffer();
                this.fboOffscreen.textureHandle = this.textureOffscreenColorID;
                this.fboOffscreen.depthTextureHandle = this.textureOffscreenDepthID;
                this.fboOffscreen.width = this.canvas.width;
                this.fboOffscreen.height = this.canvas.height;
                this.fboOffscreen.createGLData();
                this.checkGlError("offscreen FBO");
            }

            /**
             * Loads either ETC1 from PKM or falls back to loading PNG
             * @param {string} url - URL to texture without extension
             */
            loadETC1WithFallback(url) {
                var boundUpdateCallback = this.updateLoadedObjectsCount.bind(this);

                if (this.isETC1Supported) {
                    return CompressedTextureLoader.loadETC1(url + '.pkm', boundUpdateCallback);
                } else {
                    return UncompressedTextureLoader.load(url + '.png', boundUpdateCallback);
                }
            }

            /**
             * Calculates camera matrix
             * @param {number} a - position in [0...1] range
             */
            positionCamera(a) {
                var x, y, z,
                    sina, cosa;

                x = 0;
                y = 0;
                z = (Math.sin(a * 6.2831852) * 200.0) + 250.0;
                sina = Math.sin(this.angleYaw / 360.0 * 6.2831852);
                cosa = Math.cos(this.angleYaw / 360.0 * 6.2831852);
                x = sina * 460.0 * 1.5;
                y = cosa * 460.0 * 1.5;
                const lookAtZ = 75 + 20 * sina;

                MatrixUtils.mat4.identity(this.mVMatrix);
                MatrixUtils.mat4.lookAt(this.mVMatrix, [x, y, z], [0, 0, lookAtZ], [0, 0, 1]);
            }

            /**
             * Calculates projection matrix
             */
            setCameraFOV(multiplier) {
                var ratio;

                if (gl.canvas.height > 0) {
                    ratio = gl.canvas.width / gl.canvas.height;
                } else {
                    ratio = 1.0;
                }

                if (gl.canvas.width >= gl.canvas.height) {
                    this.setFOV(this.mProjMatrix, this.FOV_LANDSCAPE * multiplier, ratio, this.Z_NEAR, this.Z_FAR);
                } else {
                    this.setFOV(this.mProjMatrix, this.FOV_PORTRAIT * multiplier, ratio, this.Z_NEAR, this.Z_FAR);
                }
            }

            /**
             * Issues actual draw calls
             */
            drawScene() {
                if (!this.loaded) {
                    return;
                }

                this.positionCamera(0.0);
                this.setCameraFOV(1.0);

                gl.clearColor(0.0, 1.0, 0.0, 1.0);

                gl.colorMask(false, false, false, false);
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboOffscreen.framebufferHandle);
                gl.viewport(0, 0, this.fboOffscreen.width, this.fboOffscreen.height);
                gl.depthMask(true);
                gl.enable(gl.DEPTH_TEST);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                this.drawDepthObjects();

                gl.enable(gl.DEPTH_TEST);
                gl.enable(gl.CULL_FACE);
                gl.cullFace(gl.BACK);

                gl.colorMask(true, true, true, true);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null); // This differs from OpenGL ES
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

                this.drawSceneObjects();
                // this.drawTestDepth();
            }

            drawSceneObjects() {
                this.drawBuddha();
                this.drawSky();
                this.drawTable(1.0);
                this.drawShaft();
                this.drawDust();
                this.drawSmoke();
            }

            drawDepthObjects() {
                gl.depthMask(true);
                gl.disable(gl.BLEND);
                this.drawBuddha();
                this.drawTable(2.0);
            }

            drawTestDepth() {
                gl.enable(gl.CULL_FACE);
                gl.cullFace(gl.BACK);
                gl.disable(gl.BLEND);

                this.shaderDiffuse.use();

                this.setTexture2D(0, this.textureOffscreenDepthID, this.shaderDiffuse.sTexture);
                this.drawVignette(this.shaderDiffuse);
            }

            drawSmoke() {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE);
                gl.depthMask(false);

                const cosa = Math.cos(this.timerSmokeRotation * Math.PI * 2);
                const sina = Math.sin(this.timerSmokeRotation * Math.PI * 2);

                this.shaderSoftDiffuseColored.use();
                this.initDepthReadShader(this.shaderSoftDiffuseColored);
                this.setTexture2D(0, this.textureSmoke, this.shaderSoftDiffuseColored.sTexture);
                gl.uniform4f(
                    this.shaderSoftDiffuseColored.color,
                    this.SMOKE_COLOR.r, this.SMOKE_COLOR.g, this.SMOKE_COLOR.b, 1
                );

                for (let i = 0; i < this.m_smokeCoordinates.length; i++) {
                    const x = this.m_smokeCoordinates[i][0] * 1.5;
                    const y = this.m_smokeCoordinates[i][1] * 1.5;
                    const z = this.m_smokeCoordinates[i][2] * 0.2 + 20;
                    const rotation = i * 35 + this.timerDustRotation * 3 * (i % 2 === 0 ? 360 : -360);

                    this.drawDiffuseVBOFacingCamera(
                        this.shaderSoftDiffuseColored,
                        this.fmQuad,
                        (x * cosa - y * sina),
                        (x * sina + y * cosa),
                        z,
                        2.3, 2.3, 2.3,
                        rotation
                    );
                }

                gl.disable(gl.BLEND);
                gl.depthMask(true);
            }

            initDepthReadShader(shader) {
                gl.uniform2f(shader.cameraRange, this.Z_NEAR, this.Z_FAR); // near and far clipping planes
                gl.uniform2f(shader.invViewportSize, 1.0 / this.canvas.width, 1.0 / this.canvas.height); // inverted screen size
                gl.uniform1f(shader.transitionSize, this.SMOKE_SOFTNESS);
                this.setTexture2D(2, this.textureOffscreenDepthID, shader.sDepth);
            }

            drawDiffuseVBOFacingCamera(shader, model, tx, ty, tz, sx, sy, sz, rotation) {
                model.bindBuffers();

                gl.enableVertexAttribArray(shader.rm_Vertex);
                gl.enableVertexAttribArray(shader.rm_TexCoord0);
                gl.vertexAttribPointer(shader.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
                gl.vertexAttribPointer(shader.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);

                this.calculateMVPMatrixForSprite(tx, ty, tz, sx, sy, sz, rotation);

                gl.uniformMatrix4fv(shader.view_proj_matrix, false, this.mMVPMatrix);
                gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
                this.checkGlError("glDrawElements");
            }

            calculateMVPMatrixForSprite(tx, ty, tz, sx, sy, sz, rotation) {
                MatrixUtils.mat4.identity(this.mMMatrix);
                MatrixUtils.mat4.translate(this.mMMatrix, this.mMMatrix, [tx, ty, tz]);
                MatrixUtils.mat4.scale(this.mMMatrix, this.mMMatrix, [sx, sy, sz]);
                MatrixUtils.mat4.multiply(this.mMVPMatrix, this.mVMatrix, this.mMMatrix);
                this.resetMatrixRotations(this.mMVPMatrix);
                MatrixUtils.mat4.rotateZ(this.mMVPMatrix, this.mMVPMatrix, rotation);
                MatrixUtils.mat4.multiply(this.mMVPMatrix, this.mProjMatrix, this.mMVPMatrix);
            }

            resetMatrixRotations(matrix) {
                const d = Math.sqrt(matrix[0] * matrix[0] + matrix[1] * matrix[1] + matrix[2] * matrix[2]);
                matrix[0] = d;
                matrix[4] = 0;
                matrix[8] = 0;

                matrix[1] = 0;
                matrix[5] = d;
                matrix[9] = 0;

                matrix[2] = 0;
                matrix[6] = 0;
                matrix[10] = d;

                matrix[3] = 0;
                matrix[7] = 0;
                matrix[11] = 0;

                matrix[15] = 1;
            }

            drawDust() {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE);
                gl.depthMask(false);

                const cosa = 0.5 + Math.cos(this.timerDustFlicker * Math.PI * 2) * 0.5;
                const sina = 0.5 + Math.sin(this.timerDustFlicker * Math.PI * 2) * 0.5;

                this.shaderPointSpriteScaledColored.use();
                this.setTexture2D(0, this.textureDust, this.shaderPointSpriteScaledColored.tex0);
                gl.uniform1f(this.shaderPointSpriteScaledColored.uThickness, this.dustSpriteSize);
                gl.uniform4f(this.shaderPointSpriteScaledColored.color, this.DUST_COLOR.r * cosa, this.DUST_COLOR.g * cosa, this.DUST_COLOR.b * cosa, this.DUST_COLOR.a);

                const a = this.timerDustRotation * 360;
                const b = -this.timerDustRotation * 360;

                for (let i = 0; i < this.dustCoordinates.length; i++) {
                    if (i < this.dustCoordinates.length / 2) {
                        this.drawPointSpritesVBOTranslatedRotatedScaled(this.shaderPointSpriteScaledColored, this.fmDustPatch,
                            this.dustCoordinates[i].x, this.dustCoordinates[i].y, this.dustCoordinates[i].z,
                            a, b, a,
                            this.DUST_SCALE, this.DUST_SCALE, this.DUST_SCALE);
                    } else {
                        this.drawPointSpritesVBOTranslatedRotatedScaled(this.shaderPointSpriteScaledColored, this.fmDustPatch,
                            this.dustCoordinates[i].x, this.dustCoordinates[i].y, this.dustCoordinates[i].z,
                            b, a, b,
                            this.DUST_SCALE, this.DUST_SCALE, this.DUST_SCALE);
                    }
                    if (i == this.dustCoordinates.length / 2) {
                        gl.uniform4f(this.shaderPointSpriteScaledColored.color, this.DUST_COLOR.r * sina, this.DUST_COLOR.g * sina, this.DUST_COLOR.b * sina, this.DUST_COLOR.a);
                    }
                }

                gl.disable(gl.BLEND);
                gl.depthMask(true);
            }

            drawSky() {
                this.shaderDiffuse.use();
                this.setTexture2D(0, this.textureSky, this.shaderDiffuse.sTexture);
                this.drawDiffuseVBOTranslatedRotatedScaled(this.shaderDiffuse, this.fmSky, 0, 0, 0, 0, 0, 0, 7, 7, 3.5);
            }

            drawTable(scale) {
                // gl.depthMask(false);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                this.shaderLMTable.use();

                this.setTexture2D(0, this.textureTable, this.shaderLMTable.sTexture);
                this.setTexture2D(1, this.textureTableLM, this.shaderLMTable.sLM);
                gl.uniform1f(this.shaderLMTable.diffuseScale, 5.0);
                this.drawLMVBOTranslatedRotatedScaled(this.shaderLMTable, this.modelTable, 0, 0, 0, 0, 0, 0, scale, scale, 1);

                // gl.depthMask(true);
                gl.disable(gl.BLEND);
            }

            drawBuddha() {
                this.shaderSphericalMapLM.use();

                this.setTexture2D(0, this.textureBuddhaNormalMap, this.shaderSphericalMapLM.normalMap);
                this.setTexture2D(1, this.textureSphericalMap, this.shaderSphericalMapLM.sphereMap);
                this.setTexture2D(2, this.textureBuddhaLightMap, this.shaderSphericalMapLM.aoMap);
                this.drawSphericalMapLmVBOTranslatedRotatedScaled(this.shaderSphericalMapLM, this.modelBuddha, 0, 0, 0, 0, 0, 0, 1, 1, 1);
            }

            drawShaft() {
                gl.depthMask(false);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                this.shaderShaft.use();

                this.setTexture2D(0, this.textureShaft, this.shaderShaft.diffuseMap);
                this.drawShaftVBOTranslatedRotatedScaled(this.shaderShaft, this.fmShaft, 0, 0, 0, 0, 0, 0, 1, 1, 1);

                gl.depthMask(true);
                gl.disable(gl.BLEND);
            }

            drawVignette(shader) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.mTriangleVerticesVignette);

                gl.enableVertexAttribArray(shader.rm_Vertex);
                gl.vertexAttribPointer(shader.rm_Vertex, 3, gl.FLOAT, false, this.TRIANGLE_VERTICES_DATA_STRIDE_BYTES, 0);
                gl.enableVertexAttribArray(shader.rm_TexCoord0);
                gl.vertexAttribPointer(shader.rm_TexCoord0, 2, gl.FLOAT, false, this.TRIANGLE_VERTICES_DATA_STRIDE_BYTES, 4 * 3);

                gl.uniformMatrix4fv(shader.view_proj_matrix, false, this.mOrthoMatrix);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }

            drawPointSpritesVBOTranslatedRotatedScaled(shader, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
                model.bindBuffers();

                gl.enableVertexAttribArray(shader.aPosition);
                gl.vertexAttribPointer(shader.aPosition, 3, gl.FLOAT, false, 4 * (3 + 2), 0);

                this.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

                gl.uniformMatrix4fv(shader.uMvp, false, this.mMVPMatrix);
                gl.drawElements(gl.POINTS, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
            }

            drawShaftVBOTranslatedRotatedScaled(shader, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
                model.bindBuffers();

                gl.enableVertexAttribArray(shader.rm_Vertex);
                gl.enableVertexAttribArray(shader.rm_TexCoord0);
                gl.enableVertexAttribArray(shader.rm_Normal);

                gl.vertexAttribPointer(shader.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 0);
                gl.vertexAttribPointer(shader.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 4 * (3));
                gl.vertexAttribPointer(shader.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 4 * (3 + 2 + 2));

                this.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

                gl.uniformMatrix4fv(shader.view_matrix, false, this.mVMatrix);
                gl.uniformMatrix4fv(shader.view_proj_matrix, false, this.mMVPMatrix);
                gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
            }

            drawSphericalMapLmVBOTranslatedRotatedScaled(shader, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
                model.bindBuffers();

                gl.enableVertexAttribArray(shader.rm_Vertex);
                gl.enableVertexAttribArray(shader.rm_TexCoord0);
                gl.enableVertexAttribArray(shader.rm_TexCoord1);
                gl.enableVertexAttribArray(shader.rm_Normal);

                gl.vertexAttribPointer(shader.rm_Vertex, 3, gl.HALF_FLOAT, false, 16, 0);
                gl.vertexAttribPointer(shader.rm_TexCoord0, 2, gl.UNSIGNED_BYTE, true, 16, 2 * 3);
                gl.vertexAttribPointer(shader.rm_TexCoord1, 2, gl.UNSIGNED_BYTE, true, 16, 2 * 3 + 1 * 2);
                gl.vertexAttribPointer(shader.rm_Normal, 3, gl.BYTE, true, 16, 2 * 3 + 1 * 2 + 1 * 2);
                // gl.vertexAttribPointer(shader.rm_Normal, 4, gl.INT_2_10_10_10_REV, true, 16, 12);

                this.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

                gl.uniformMatrix4fv(shader.view_matrix, false, this.mVMatrix);
                gl.uniformMatrix4fv(shader.view_proj_matrix, false, this.mMVPMatrix);
                gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
            }

            drawDiffuseVBOTranslatedRotatedScaled(shader, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
                model.bindBuffers();

                gl.enableVertexAttribArray(shader.rm_Vertex);
                gl.enableVertexAttribArray(shader.rm_TexCoord0);

                gl.vertexAttribPointer(shader.rm_Vertex, 3, gl.HALF_FLOAT, false, 8, 0);
                gl.vertexAttribPointer(shader.rm_TexCoord0, 2, gl.UNSIGNED_BYTE, true, 8, 2 * 3);

                this.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

                gl.uniformMatrix4fv(shader.view_proj_matrix, false, this.mMVPMatrix);
                gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
            }

            drawLMVBOTranslatedRotatedScaled(shader, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
                model.bindBuffers();

                gl.enableVertexAttribArray(shader.rm_Vertex);
                gl.enableVertexAttribArray(shader.rm_TexCoord0);
                gl.enableVertexAttribArray(shader.rm_TexCoord1);

                gl.vertexAttribPointer(shader.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 2), 0);
                gl.vertexAttribPointer(shader.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 2), 4 * (3));
                gl.vertexAttribPointer(shader.rm_TexCoord1, 2, gl.FLOAT, false, 4 * (3 + 2 + 2), 4 * (3 + 2));

                this.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

                gl.uniformMatrix4fv(shader.view_proj_matrix, false, this.mMVPMatrix);
                gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
            }

            /**
             * Updates camera rotation
             */
            animate() {
                var timeNow = new Date().getTime(),
                    elapsed;

                if (this.lastTime != 0) {
                    elapsed = timeNow - this.lastTime;

                    this.angleYaw += elapsed / this.YAW_COEFF_NORMAL;
                    this.angleYaw %= 360.0;

                    this.timerDustRotation = (timeNow % this.DUST_SPEED) / this.DUST_SPEED;
                    this.timerDustFlicker = (timeNow % this.DUST_FLICKER_SPEED) / this.DUST_FLICKER_SPEED;
                    this.timerSmokeRotation = (timeNow % this.SMOKE_SPEED) / this.SMOKE_SPEED;
                }

                this.lastTime = timeNow;
            }
        }

        return BuddhaRenderer;
    });
