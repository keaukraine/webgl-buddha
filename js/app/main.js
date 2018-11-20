'use strict';

define([
    'BuddhaRenderer',
    'framework/utils/FullscreenUtils'
],
    function (
        BuddhaRenderer,
        FullScreenUtils) {

        var renderer;

        /**
         * Initialize renderer with current scene configuration
         */
        function initRenderer() {
            window.gl = null;

            if (renderer) {
                renderer.resetLoaded();
                oldYaw = renderer.angleYaw;
            }

            renderer = new BuddhaRenderer();

            renderer.init('canvasGL');
            renderer.angleYaw = 30;
        }

        function loadedHandler() {
            initRenderer();

            if (FullScreenUtils.isFullScreenSupported()) {
                const toggleFullscreenElement = document.getElementById('toggleFullscreen');

                toggleFullscreenElement.addEventListener('click', () => {
                    if (document.body.classList.contains('fs')) {
                        FullScreenUtils.exitFullScreen();
                    } else {
                        FullScreenUtils.enterFullScreen();
                    }
                    FullScreenUtils.addFullScreenListener(function () {
                        if (FullScreenUtils.isFullScreen()) {
                            document.body.classList.add('fs');
                        } else {
                            document.body.classList.remove('fs');
                        }
                    });
                });
            } else {
                toggleFullscreenElement.classList.add('hidden');
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadedHandler);
        } else {
            loadedHandler();
        }
    });
