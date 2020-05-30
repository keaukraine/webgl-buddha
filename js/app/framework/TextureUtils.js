'use strict';

define(() => {

    function TextureUtils() { }

    TextureUtils.createNPOTTexture = (texWidth, texHeight, bUseAlpha) => {
        const textureID = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textureID);
        gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        let glFormat = null, glInternalFormat = null;

        if (bUseAlpha) {
            glFormat = gl.RGBA;
            glInternalFormat = gl.RGBA;
        } else {
            glFormat = gl.RGB;
            glInternalFormat = gl.RGB;
        }

        gl.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, texWidth, texHeight, 0, glFormat, gl.UNSIGNED_BYTE, null);

        return textureID;
    };

    TextureUtils.createDepthTexture = (texWidth, texHeight) => {
        const textureID = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textureID);

        gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const glFormat = gl.DEPTH_COMPONENT;
        const glInternalFormat = gl.DEPTH_COMPONENT16;
        const type = gl.UNSIGNED_SHORT;

        // In WebGL, we cannot pass array to depth texture.
        gl.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, texWidth, texHeight, 0, glFormat, type, null);

        return textureID;
    };

    return TextureUtils;
});
