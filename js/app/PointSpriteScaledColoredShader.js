'use strict';

define(['framework/BaseShader'], function (BaseShader) {
    /**
     * Shader to render colored point sprites.
     */
    class PointSpriteScaledColoredShader extends BaseShader {
        fillCode() {
            this.vertexShaderCode = "uniform mat4 uMvp;\n" +
                "uniform float uThickness;\n" +
                "uniform float uRotation;\n" +
                "\n" +
                "attribute vec3 aPosition;\n" +
                "varying mat2 rotn;\n" +
                "\n" +
                "void main() {\n" +
                "    vec4 position = uMvp * vec4(aPosition.xyz, 1.0);\n" +
                "    vec3 ndc = position.xyz / position.w; // perspective divide.\n" +
                "    float zDist = 1.0 - ndc.z; // 1 is close (right up in your face,)\n" +
                "    gl_PointSize = uThickness * zDist;\n" +
                // "    float rot = mod(aPosition.x, 2.0) > 1.0 ? uRotation : -uRotation;\n" +
                "    float rot = (0.5 - (mod(aPosition.x, 2.0) - mod(aPosition.x, 1.0))) * 2.0 * uRotation;\n" +
                "    float rotation = rot + aPosition.x + aPosition.y + aPosition.z;\n" +
                "    rotn = mat2(cos(rotation), sin(rotation)," +
                "        -sin(rotation), cos(rotation)); \n" +
                "    gl_Position =  position;  \n" +
                "}";

            this.fragmentShaderCode = "precision mediump float;\n" +
                "uniform sampler2D tex0;\n" +
                "uniform vec4 color;\n" +
                "uniform vec2 spriteOffset;\n" +
                "varying mat2 rotn;\n" +
                "\n" +
                "void main() \n" +
                "{\n" +
                "    vec2 centre = vec2(0.5, 0.5);\n" +
                "    vec2 coords = vec2(gl_PointCoord.x, gl_PointCoord.y);\n" +
                "    vec2 rot_coord = rotn * (coords - centre) + centre;\n" +
                "    rot_coord.x = rot_coord.x * 0.125 + spriteOffset.x;\n" +
                "    gl_FragColor = texture2D(tex0, rot_coord) * color;\n" +
                "}";
        }

        fillUniformsAttributes() {
            this.uMvp = this.getUniform("uMvp");
            this.uThickness = this.getUniform("uThickness");
            this.aPosition = this.getAttrib("aPosition");
            this.tex0 = this.getUniform("tex0");
            this.color = this.getUniform("color");
            this.uRotation = this.getUniform("uRotation");
            this.spriteOffset = this.getUniform("spriteOffset");
        }
    }

    return PointSpriteScaledColoredShader;
});
