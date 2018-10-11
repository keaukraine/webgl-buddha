'use strict';

define([
        'framework/BaseRenderer',
        'jquery',
        'DiffuseShader',
        'LightShaftShader',
        'SphericalMapLMShader',
        'LMTableShader',
        'framework/utils/MatrixUtils',
        'framework/FullModel',
        'framework/UncompressedTextureLoader',
        'framework/CompressedTextureLoader'
    ],
    function(
        BaseRenderer,
        $,
        DiffuseShader,
        LightShaftShader,
        SphericalMapLMShader,
        LMTableShader,
        MatrixUtils,
        FullModel,
        UncompressedTextureLoader,
        CompressedTextureLoader) {

        class BuddhaRenderer extends BaseRenderer {
            constructor() {
                super();

                this.loadedItemsCount = 0; // couter of loaded OpenGL buffers+textures
                this.loaded = false; // won't draw until this is true

                this.angleYaw = 0; // camera rotation angle
                this.lastTime = 0; // used for animating camera

                this.coinModelType = '1'; // coin mesh: 1, 2, 3, 4
                this.coinNormalType = '1'; // coin normal texture: 1, 2, 3
                this.coinSphericalMap = 'gold2'; // coin spherical map texture: 'bronze', 'gold2', 'silver'
                this.tableTextureType = 'marble'; // floor texture: 'granite', 'marble', 'wood3'
                this.skyTextureType = 'sky3';

                this.ITEMS_TO_LOAD = 11; // total number of OpenGL buffers+textures to load
                this.FLOAT_SIZE_BYTES = 4; // float size, used to calculate stride sizes
                this.TRIANGLE_VERTICES_DATA_STRIDE_BYTES = 5 * this.FLOAT_SIZE_BYTES;
                this.TRIANGLE_VERTICES_DATA_POS_OFFSET = 0;
                this.TRIANGLE_VERTICES_DATA_UV_OFFSET = 3;
                this.FOV_LANDSCAPE = 25.0; // FOV for landscape
                this.FOV_PORTRAIT = 40.0; // FOV for portrait
                this.YAW_COEFF_NORMAL = 50.0; // camera rotation speed
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

                $('#canvasGL').show();
            }

            onInitError() {
                super.onInitError();

                $(canvas).hide();
                $('#alertError').show();
            }

            initShaders() {
                this.shaderSphericalMapLM = new SphericalMapLMShader();
                this.shaderLMTable = new LMTableShader();
                this.shaderDiffuse = new DiffuseShader();
                this.shaderShaft = new LightShaftShader();
            }

            /**
             * Callback for all loading function. Updates loading progress and allows rendering after loading all stuff
             */
            updateLoadedObjectsCount() {
                var percent,
                    $progress = $('#progressLoading');

                this.loadedItemsCount++; // increase loaded objects counter

                percent = Math.floor(this.loadedItemsCount * 100 / this.ITEMS_TO_LOAD) + '%';
                $progress
                    .css('width', percent)
                    .html(percent); // update loading progress

                if (this.loadedItemsCount >= this.ITEMS_TO_LOAD) {
                    this.loaded = true; // allow rendering
                    console.log('Loaded all assets');
                    $('#divControls').addClass('transparent');
                    setTimeout(() => $('#divControls').hide(), 1000);
                    setTimeout(() => $('.control-icon').removeClass('transparent'), 1200);
                }
            }

            /**
             * loads all WebGL buffers and textures. Uses updateLoadedObjectsCount() callback to indicate that data is loaded to GPU
             */
            loadData() {
                var boundUpdateCallback = this.updateLoadedObjectsCount.bind(this);

                this.textureCoinsNormalMap = UncompressedTextureLoader.load('data/textures/buddha-normals.png', boundUpdateCallback);
                this.textureSphericalMap = UncompressedTextureLoader.load('data/textures/sphere_gold3.png', boundUpdateCallback);
                this.textureBuddhaLightMap = UncompressedTextureLoader.load('data/textures/buddha_lm.png', boundUpdateCallback);
                this.textureTable = this.loadETC1WithFallback('data/textures/table/marble');
                this.textureTableLM = UncompressedTextureLoader.load('data/textures/table/table_lm.png', boundUpdateCallback);
                this.textureSky = UncompressedTextureLoader.load('data/textures/sky/sky1.png', boundUpdateCallback);
                this.textureShaft = UncompressedTextureLoader.load('data/textures/shafts.png', boundUpdateCallback);

                this.modelTable = new FullModel();
                this.modelTable.load('data/models/table', boundUpdateCallback);
                this.modelCoins = new FullModel();
                this.modelCoins.load('data/models/buddha', boundUpdateCallback);

                this.fmSky = new FullModel();
                this.fmSky.load('data/models/sky', boundUpdateCallback);

                this.fmShaft = new FullModel();
                this.fmShaft.load('data/models/shafts', boundUpdateCallback);
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
                    this.setFOV(this.mProjMatrix, this.FOV_LANDSCAPE * multiplier, ratio, 20.0, 11000.0);
                } else {
                    this.setFOV(this.mProjMatrix, this.FOV_PORTRAIT * multiplier, ratio, 20.0, 11000.0);
                }
            }

            /**
             * Issues actual draw calls
             */
            drawScene() {
                if (!this.loaded) {
                    return;
                }

                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                gl.clearColor(0.0, 1.0, 0.0, 1.0);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

                gl.enable(gl.DEPTH_TEST);
                gl.enable(gl.CULL_FACE);
                gl.cullFace(gl.BACK);

                this.positionCamera(0.0);
                this.setCameraFOV(1.0);

                this.drawCoins();
                this.drawSky();
                this.drawTable();
                this.drawShaft();
            }

            drawSky() {
                this.shaderDiffuse.use();
                this.setTexture2D(0, this.textureSky, this.shaderDiffuse.sTexture);
                this.drawDiffuseVBOTranslatedRotatedScaled(this.shaderDiffuse, this.fmSky, 0, 0, 0, 0, 0, 0, 7, 7, 3.5);
            }

            drawTable() {
                gl.depthMask(false);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                this.shaderLMTable.use();

                this.setTexture2D(0, this.textureTable, this.shaderLMTable.sTexture);
                this.setTexture2D(1, this.textureTableLM, this.shaderLMTable.sLM);
                gl.uniform1f(this.shaderLMTable.diffuseScale, 5.0);
                this.drawLMVBOTranslatedRotatedScaled(this.shaderLMTable, this.modelTable, 0, 0, 0, 0, 0, 0, 1, 1, 1);

                gl.depthMask(true);
                gl.disable(gl.BLEND);
            }

            drawCoins() {
                this.shaderSphericalMapLM.use();

                this.setTexture2D(0, this.textureCoinsNormalMap, this.shaderSphericalMapLM.normalMap);
                this.setTexture2D(1, this.textureSphericalMap, this.shaderSphericalMapLM.sphereMap);
                this.setTexture2D(2, this.textureBuddhaLightMap, this.shaderSphericalMapLM.aoMap);
                this.drawCoinVBOTranslatedRotatedScaled(this.shaderSphericalMapLM, this.modelCoins, 0, 0, 0, 0, 0, 0, 1, 1, 1);
            }

            drawShaft() {
                gl.depthMask(false);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                this.shaderShaft.use();

                this.setTexture2D(0, this.textureShaft, this.shaderShaft.diffuseMap);
                //this.setTexture2D(1, this.textureShaft, this.shaderShaft.sphereMap);
                //this.setTexture2D(2, this.textureShaft, this.shaderShaft.aoMap);
                this.drawShaftVBOTranslatedRotatedScaled(this.shaderShaft, this.fmShaft, 0, 0, 0, 0, 0, 0, 1, 1, 1);

                gl.depthMask(true);
                gl.disable(gl.BLEND);
            }

            drawShaftVBOTranslatedRotatedScaled(shader, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
                model.bindBuffers();

                gl.enableVertexAttribArray(shader.rm_Vertex);
                gl.enableVertexAttribArray(shader.rm_TexCoord0);
                //gl.enableVertexAttribArray(shader.rm_TexCoord1);
                gl.enableVertexAttribArray(shader.rm_Normal);

                gl.vertexAttribPointer(shader.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 0);
                gl.vertexAttribPointer(shader.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 4 * (3));
                //gl.vertexAttribPointer(shader.rm_TexCoord1, 2, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 4 * (3 + 2));
                gl.vertexAttribPointer(shader.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 4 * (3 + 2 + 2));

                this.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

                gl.uniformMatrix4fv(shader.view_matrix, false, this.mVMatrix);
                gl.uniformMatrix4fv(shader.view_proj_matrix, false, this.mMVPMatrix);
                gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
            }

            drawCoinVBOTranslatedRotatedScaled(shader, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
                model.bindBuffers();

                gl.enableVertexAttribArray(shader.rm_Vertex);
                gl.enableVertexAttribArray(shader.rm_TexCoord0);
                gl.enableVertexAttribArray(shader.rm_TexCoord1);
                gl.enableVertexAttribArray(shader.rm_Normal);

                gl.vertexAttribPointer(shader.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 0);
                gl.vertexAttribPointer(shader.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 4 * (3));
                gl.vertexAttribPointer(shader.rm_TexCoord1, 2, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 4 * (3 + 2));
                gl.vertexAttribPointer(shader.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 2 + 3), 4 * (3 + 2 + 2));

                this.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

                gl.uniformMatrix4fv(shader.view_matrix, false, this.mVMatrix);
                gl.uniformMatrix4fv(shader.view_proj_matrix, false, this.mMVPMatrix);
                gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
            }

            drawDiffuseVBOTranslatedRotatedScaled(shader, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
                model.bindBuffers();

                gl.enableVertexAttribArray(shader.rm_Vertex);
                gl.enableVertexAttribArray(shader.rm_TexCoord0);

                gl.vertexAttribPointer(shader.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
                gl.vertexAttribPointer(shader.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);

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
                }

                this.lastTime = timeNow;
            }
        }

        return BuddhaRenderer;
    });
