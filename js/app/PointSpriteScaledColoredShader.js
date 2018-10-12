'use strict';

define(['framework/BaseShader'], function (BaseShader) {
    /**
     * Shader to render colored point sprites.
     */
    class PointSpriteScaledColoredShader extends BaseShader {
        fillCode() {
            this.vertexShaderCode = "uniform mat4 uMvp;\n" +
                "uniform float uThickness;\n" +
                "\n" +
                "attribute vec3 aPosition;\n" +
                "\n" +
                "void main() {\n" +
                "    vec4 position = uMvp * vec4(aPosition.xyz, 1.0);\n" +
                "    vec3 ndc = position.xyz / position.w; // perspective divide.\n" +
                "    float zDist = 1.0 - ndc.z; // 1 is close (right up in your face,)\n" +
                "    gl_PointSize = uThickness * zDist;\n" +
                "    gl_Position =  position;  \n" +
                "}";
            this.fragmentShaderCode = "precision mediump float;\n" +
                "uniform sampler2D tex0;\n" +
                "uniform vec4 color;\n" +
                "\n" +
                "void main() \n" +
                "{\n" +
                "   gl_FragColor = texture2D(tex0, gl_PointCoord) * color;\n" +
                "}";
        }

        fillUniformsAttributes() {
            this.uMvp = this.getUniform("uMvp");
            this.uThickness = this.getUniform("uThickness");
            this.aPosition = this.getAttrib("aPosition");
            this.tex0 = this.getUniform("tex0");
            this.color = this.getUniform("color");
        }
    }

    return PointSpriteScaledColoredShader;
});
