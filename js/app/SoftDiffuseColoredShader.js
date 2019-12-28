'use strict';

define(['framework/BaseShader'], function (BaseShader) {

    /**
     * Shader for table. Uses diffuse and lightmap textures.
     * @class
     */
    class SoftDiffuseColoredShader extends BaseShader {
        fillCode() {
            this.vertexShaderCode = "uniform mat4 view_proj_matrix;\n" +
                "attribute vec4 rm_Vertex;\n" +
                "attribute vec2 rm_TexCoord0;\n" +
                "varying vec2 vTextureCoord;\n" +
                "\n" +
                "void main() {\n" +
                "  gl_Position = view_proj_matrix * rm_Vertex;\n" +
                "  vTextureCoord = rm_TexCoord0;\n" +
                "}";


            this.fragmentShaderCode = "precision highp float;\n" +
                "uniform vec2 uCameraRange;\n" +
                "uniform vec2 uInvViewportSize;\n" +
                "uniform float uTransitionSize;\n" +
                "float calc_depth(in float z)\n" +
                "{\n" +
                "  return (2.0 * uCameraRange.x) / (uCameraRange.y + uCameraRange.x - z*(uCameraRange.y - uCameraRange.x));\n" +
                "}\n" +
                "uniform sampler2D sDepth;\n" +
                "varying vec2 vTextureCoord;\n" +
                "uniform sampler2D sTexture;\n" +
                "uniform vec4 color;\n" +
                "\n" +
                "void main() {\n" +
                "   vec4 diffuse = texture2D(sTexture, vTextureCoord) * color;\n" +
                //                "   diffuse += vec4(0.0, 0.0, 1.0, 1.0);\n"+ // fixme
                "   vec2 coords = gl_FragCoord.xy * uInvViewportSize;\n" +
                "   float geometryZ = calc_depth(texture2D(sDepth, coords).r);\n" +
                "   float sceneZ = calc_depth(gl_FragCoord.z);\n" +
                "   float a = clamp(geometryZ - sceneZ, 0.0, 1.0);\n" +
                "   float b = smoothstep(0.0, uTransitionSize, a);\n" +
                "   gl_FragColor = diffuse * b;\n" +
                "}";
        }

        fillUniformsAttributes() {
            this.view_proj_matrix = this.getUniform("view_proj_matrix");
            this.rm_Vertex = this.getAttrib("rm_Vertex");
            this.rm_TexCoord0 = this.getAttrib("rm_TexCoord0");
            this.sTexture = this.getUniform("sTexture");
            this.cameraRange = this.getUniform("uCameraRange");
            this.sDepth = this.getUniform("sDepth");
            this.invViewportSize = this.getUniform("uInvViewportSize");
            this.uTransitionSize = this.getUniform("uTransitionSize");
            this.color = this.getUniform("color");
        }
    }

    return SoftDiffuseColoredShader;
});
