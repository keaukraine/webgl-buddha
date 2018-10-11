'use strict';

define(['framework/BaseShader'], function(BaseShader) {

    /**
     * Sahder to render coins. Uses spherical map for reflection and diffuse, normal and light maps.
     */
    class LightShaftShader extends BaseShader {
        fillCode() {
            this.vertexShaderCode = 'precision highp float;\r\n' +
                'uniform mat4 view_proj_matrix;\r\n' +
                'uniform mat4 view_matrix;\r\n' +
                '\r\n' +
                'attribute vec4 rm_Vertex;\r\n' +
                'attribute vec2 rm_TexCoord0;\r\n' +
                'attribute vec3 rm_Normal;\r\n' +
                '\r\n' +
                'varying vec3 vNormal;\r\n' +
                'varying vec2 vTexCoord0;\r\n' +
                '\r\n' +
                'void main( void )\r\n' +
                '{\r\n' +
                '   gl_Position = view_proj_matrix * rm_Vertex;\r\n' +
                '\r\n' +
                '   vTexCoord0 = vec2(rm_TexCoord0);\r\n' +
                '\r\n' +
                '   vNormal = (view_matrix * vec4(rm_Normal, 0.0)).xyz;\r\n' +
                '}';

            this.fragmentShaderCode = 'precision highp float;\r\n' +
                'uniform sampler2D diffuseMap;\r\n' +
                'varying vec2 vTexCoord0;\r\n' +
                'varying vec3 vNormal;\r\n' +
                '\r\n' +
                'void main()\r\n' +
                '{\r\n' +
                '   vec3 normColor = texture2D(diffuseMap,vTexCoord0).rgb;\r\n' +
                '     \r\n' +
                '   float rimAmount = clamp(pow(vNormal.b - 0.65, 1.0), 0.0, 1.0);' +
                '   ' +
                '   ' +
                '   gl_FragColor = vec4(normColor.r,normColor.g,normColor.b, normColor.b*rimAmount);\r\n' +
                '}';
        }

        fillUniformsAttributes() {
            this.view_proj_matrix = this.getUniform('view_proj_matrix');
            this.view_matrix = this.getUniform('view_matrix');
            this.rm_Vertex = this.getAttrib('rm_Vertex');
            this.rm_TexCoord0 = this.getAttrib('rm_TexCoord0');
            this.rm_Normal = this.getAttrib('rm_Normal');
            this.diffuseMap = this.getUniform('diffuseMap');
            this.sphereMap = this.getUniform('sphereMap');
            this.aoMap = this.getUniform('aoMap');
        }
    }

    return LightShaftShader;
});
