var VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec4 a_Normal;
    attribute vec2 a_TexCoord;
    uniform mat4 u_MvpMatrix;
    uniform mat4 u_modelMatrix;
    uniform mat4 u_normalMatrix;
    uniform mat4 u_MvpMatrixOfLight;
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    varying vec2 v_TexCoord;
    uniform mat4 u_ProjMatrixFromLight;
    varying vec4 v_PositionFromLight;

    void main(){
        gl_Position = u_MvpMatrix * a_Position;
        v_PositionInWorld = (u_modelMatrix * a_Position).xyz; 
        v_Normal = normalize(vec3(u_normalMatrix * a_Normal));
        v_PositionFromLight = u_MvpMatrixOfLight * a_Position; //for shadow
        v_TexCoord = a_TexCoord;
    }    
`;

var FSHADER_SOURCE = `
    precision mediump float;
    uniform vec3 u_LightPosition;
    uniform vec3 u_ViewPosition;
    uniform float u_Ka;
    uniform float u_Kd;
    uniform float u_Ks;
    uniform float u_shininess;
    uniform sampler2D u_Sampler;
    uniform vec3 u_Color;
    uniform sampler2D u_ShadowMap;
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    varying vec2 v_TexCoord;
    varying vec4 v_PositionFromLight;
    const float deMachThreshold = 0.005; //0.001 if having high precision depth
    // varying vec2 v_texcoord;
    uniform sampler2D u_texture;
    float unpackFloatFromVec4i(const vec4 value) {
        const vec4 bitSh = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);
        return(dot(value, bitSh));
      }
    void main(){ 
        vec3 texColor = texture2D( u_Sampler, v_TexCoord ).rgb;
        vec3 ambientLightColor = texColor;
        vec3 diffuseLightColor = texColor;
        vec3 specularLightColor = vec3(1.0, 1.0, 1.0);        

        vec3 ambient = ambientLightColor * u_Ka;

        vec3 normal = normalize(v_Normal);
        vec3 lightDirection = normalize(u_LightPosition - v_PositionInWorld);
        float nDotL = max(dot(lightDirection, normal), 0.0);
        vec3 diffuse = diffuseLightColor * u_Kd * nDotL;

        vec3 specular = vec3(0.0, 0.0, 0.0);
        if(nDotL > 0.0) {
            vec3 R = reflect(-lightDirection, normal);
            // V: the vector, point to viewer       
            vec3 V = normalize(u_ViewPosition - v_PositionInWorld); 
            float specAngle = clamp(dot(R, V), 0.0, 1.0);
            specular = u_Ks * pow(specAngle, u_shininess) * specularLightColor; 
        }

        //***** shadow
        vec3 shadowCoord = (v_PositionFromLight.xyz/v_PositionFromLight.w)/2.0 + 0.5;
        vec4 rgbaDepth = texture2D(u_ShadowMap, shadowCoord.xy);
        /////////******** LOW precision depth implementation ********///////////
        // float depth = rgbaDepth.r;
        float depth = unpackFloatFromVec4i(rgbaDepth);
        float visibility = (shadowCoord.z > depth + deMachThreshold) ? 0.3 : 1.0;
        // gl_FragColor = texture2D(u_texture, v_TexCoord);

        gl_FragColor = vec4( (ambient + diffuse + specular)*visibility, 1.0);
    }
`;
var VSHADER_QUAD_SOURCE = `
    attribute vec4 a_Position;
    void main(){
        gl_Position = a_Position;
    }    
`;

var FSHADER_QUAD_SOURCE = `
    precision mediump float;
    uniform sampler2D u_ShadowMap;
    void main(){ 
      //TODO-2: look up the depth from u_ShaodowMap and draw on quad (just one line)
        gl_FragColor = texture2D(u_ShadowMap, gl_FragCoord.xy/vec2(800.0,800.0));
    }
`;
var VSHADER_SHADOW_SOURCE = `
      attribute vec4 a_Position;
      uniform mat4 u_MvpMatrix;
      void main(){
          gl_Position = u_MvpMatrix * a_Position;
      }
  `;

var FSHADER_SHADOW_SOURCE = `
    precision mediump float;
    vec4 packFloatToVec4i(const float value) {
        const vec4 bitSh = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);
        const vec4 bitMsk = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);
        vec4 res = fract(value * bitSh);
        res -= res.xxyz * bitMsk;
        return res;
      }
     
    void main(){
    /////////** LOW precision depth implementation **/////
        // gl_FragColor = vec4(gl_FragCoord.z,0.0,0.0, 1.0);
        gl_FragColor = packFloatToVec4i(gl_FragCoord.z);
    }
  `;

function compileShader(gl, vShaderText, fShaderText) {
    //////Build vertex and fragment shader objects
    var vertexShader = gl.createShader(gl.VERTEX_SHADER)
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    //The way to  set up shader text source
    gl.shaderSource(vertexShader, vShaderText)
    gl.shaderSource(fragmentShader, fShaderText)
    //compile vertex shader
    gl.compileShader(vertexShader)
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.log('vertex shader ereror');
        var message = gl.getShaderInfoLog(vertexShader);
        console.log(message);//print shader compiling error message
    }
    //compile fragment shader
    gl.compileShader(fragmentShader)
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.log('fragment shader ereror');
        var message = gl.getShaderInfoLog(fragmentShader);
        console.log(message);//print shader compiling error message
    }

    /////link shader to program (by a self-define function)
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    //if not success, log the program info, and delete it.
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert(gl.getProgramInfoLog(program) + "");
        gl.deleteProgram(program);
    }

    return program;
}
function initAttributeVariable(gl, a_attribute, buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_attribute, buffer.num, buffer.type, false, 0, 0);
    gl.enableVertexAttribArray(a_attribute);
}

function initArrayBufferForLaterUse(gl, data, num, type) {
    // Create a buffer object
    var buffer = gl.createBuffer();
    if (!buffer) {
        console.log('Failed to create the buffer object');
        return null;
    }
    // Write date into the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    // Store the necessary information to assign the object to the attribute variable later
    buffer.num = num;
    buffer.type = type;

    return buffer;
}

function initVertexBufferForLaterUse(gl, vertices, normals, texCoords) {
    var nVertices = vertices.length / 3;

    var o = new Object();
    o.vertexBuffer = initArrayBufferForLaterUse(gl, new Float32Array(vertices), 3, gl.FLOAT);
    if (normals != null) o.normalBuffer = initArrayBufferForLaterUse(gl, new Float32Array(normals), 3, gl.FLOAT);
    if (texCoords != null) o.texCoordBuffer = initArrayBufferForLaterUse(gl, new Float32Array(texCoords), 2, gl.FLOAT);
    //you can have error check here
    o.numVertices = nVertices;

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return o;
}
var mouseLastX, mouseLastY;
var mouseDragging = false;
var angleX = 0, angleY = 0;
var gl, canvas;
var mvpMatrix, modelMatrix, normalMatrix, rotateMatrix;
var nVertex;
var botX = 0, botY = 0, botZ = 0;
var lightX = -5, lightY = 10, lightZ = 0;
var ScreenX = -5, ScreenY = 10, ScreenZ = 0;
var offScreenWidth = 2048, offScreenHeight = 2048;
var normalMode = true;
var fboShadow;
var cameraX = 3, cameraY = 3, cameraZ = 7;
var textures = {};
var texCount = 0;
var coffinObj = [];
var cubeObj = [];
var numTextures = 1; //brick
var quadObj;
// var starantiObj = [];
// var normalMode = true;

var legAngel = 0;
var firststringangle = 0;
var secondstringangle = 0;
var stickangle = 0;
var stick2angle = 0;
var touch = 0;
var grab = 0;
var coffinX, coffinY, coffinZ;
// var x = 160
async function putModel(file, O) {

    response = await fetch(file);
    text = await response.text();
    obj = parseOBJ(text);
    for (let i = 0; i < obj.geometries.length; i++) {
        let o = initVertexBufferForLaterUse(gl,
            obj.geometries[i].data.position,
            obj.geometries[i].data.normal,
            obj.geometries[i].data.texcoord);
        O.push(o);
    }
}

function onloadTexture(tex, file) {
    var img = new Image();
    img.onload = function () { initTexture(gl, img, tex); };
    img.src = file;
}
async function main() {
    canvas = document.getElementById('webgl');
    gl = canvas.getContext('webgl2');
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }
    var quad = new Float32Array(
        [
            -1, -1, 0,
            1, -1, 0,
            -1, 1, 0,
            -1, 1, 0,
            1, -1, 0,
            1, 1, 0
        ]);
    quadProgram = compileShader(gl, VSHADER_QUAD_SOURCE, FSHADER_QUAD_SOURCE);
    quadProgram.a_Position = gl.getAttribLocation(quadProgram, 'a_Position');
    quadProgram.u_ShadowMap = gl.getUniformLocation(quadProgram, "u_ShadowMap");
    quadObj = initVertexBufferForLaterUse(gl, quad);

    //setup shaders and prepare shader variables
    shadowProgram = compileShader(gl, VSHADER_SHADOW_SOURCE, FSHADER_SHADOW_SOURCE);
    shadowProgram.a_Position = gl.getAttribLocation(shadowProgram, 'a_Position');
    shadowProgram.u_MvpMatrix = gl.getUniformLocation(shadowProgram, 'u_MvpMatrix');

    program = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);

    program.a_Position = gl.getAttribLocation(program, 'a_Position');
    program.a_Normal = gl.getAttribLocation(program, 'a_Normal');
    program.u_MvpMatrix = gl.getUniformLocation(program, 'u_MvpMatrix');
    program.u_modelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');
    program.u_normalMatrix = gl.getUniformLocation(program, 'u_normalMatrix');
    program.u_LightPosition = gl.getUniformLocation(program, 'u_LightPosition');
    program.u_ViewPosition = gl.getUniformLocation(program, 'u_ViewPosition');
    program.u_MvpMatrixOfLight = gl.getUniformLocation(program, 'u_MvpMatrixOfLight');
    program.a_TexCoord = gl.getAttribLocation(program, 'a_TexCoord');
    program.u_Ka = gl.getUniformLocation(program, 'u_Ka');
    program.u_Kd = gl.getUniformLocation(program, 'u_Kd');
    program.u_Ks = gl.getUniformLocation(program, 'u_Ks');
    program.u_shininess = gl.getUniformLocation(program, 'u_shininess');
    program.u_ShadowMap = gl.getUniformLocation(program, "u_ShadowMap");
    program.u_Color = gl.getUniformLocation(program, 'u_Color');
    program.u_Sampler = gl.getUniformLocation(program, "u_Sampler")

    gl.useProgram(program);


    putModel('./Coffin.obj', coffinObj);
    putModel('./cube.obj', cubeObj);
    // putModel('./star/obj/objStar.obj', starantiObj, antistarcolor);


    onloadTexture('tvTex', './texture/black.png')
    onloadTexture('coffinTex', './texture/coffin.png')
    onloadTexture('StoneTex', './texture/cobblestone.png')
    onloadTexture('HeadTex', './texture/skin.png')
    onloadTexture('FloorTex', './texture/floor.jpg')
    onloadTexture('LightTex', './texture/white.png')
    onloadTexture('BodyTex', './texture/purple.png')
    onloadTexture('BodyTouchTex', './texture/yellow.png')
    onloadTexture('ArmTex', './texture/skin.png')
    onloadTexture('LegTex', './texture/pant.png')
    onloadTexture('RodTex', './texture/log.jpg')
    onloadTexture('StringTex', './texture/white.png')
    onloadTexture('BuoyTex', './texture/cobblestone.png')
    fboShadow = initFrameBuffer(gl);
    fbo = initFrameBuffer(gl);
    //x,z,y
    coffinX = Math.random() * 10 - 5;
    coffinY = Math.random();
    coffinZ = Math.random() * 10 - 5;

    mvpMatrix = new Matrix4();
    modelMatrix = new Matrix4();
    normalMatrix = new Matrix4();
    rotateMatrix = new Matrix4();


    draw();//draw it once before mouse move

    canvas.onmousedown = function (ev) { mouseDown(ev) };
    canvas.onmousemove = function (ev) { mouseMove(ev) };
    canvas.onmouseup = function (ev) { mouseUp(ev) };
    canvas.onwheel = function (ev) { scroll(ev) };
    var menu = document.getElementById("menu");
    menu.onchange = function () {
        if (this.value == "normal") normalMode = true;
        else normalMode = false;
        draw();
    }
    document.addEventListener('keydown', (event) => {
        /*
        if (event.key == 'j') {

            bhangle += 5;

            draw();
        } 
        else if (event.key == 'J') {

            bhangle -= 5;

            draw();
        } else if (event.key == 'k') {
            bh2angle += 5;
            draw();
        } else if (event.key == 'K') {
            bh2angle -= 5;
            draw();
        } 
        else 
        */
        if (event.key == 'w' || event.key == 'W') {
            botZ -= 0.28;
            // cameraZ -= 0.28;
            legAngel -= 0.3;
            draw();
        } else if (event.key == 's' || event.key == 'S') {
            botZ += 0.28;
            // cameraZ += 0.28;
            legAngel += 0.3;
            draw();
        } else if (event.key == 'a' || event.key == 'A') {
            botX -= 0.28;
            // cameraX -= 0.28;
            legAngel -= 0.3;
            draw();
        } else if (event.key == 'd' || event.key == 'D') {
            botX += 0.28;
            // cameraX += 0.28; 
            legAngel += 0.3;
            draw();
        } else if (event.key == ' ') {
            if (botY == 0) {
                console.log("space");
                botY += 10;
            }
            draw();
        } else if (event.key == 'u') {
            secondstringangle += 5
            draw();
        } else if (event.key == 'y') {
            firststringangle += 5
            draw();
        } else if (event.key == 't') {
            if (stick2angle < 30)
                stick2angle += 5
            draw();
        } else if (event.key == 'r') {
            stickangle += 5
            draw();
        } else if (event.key == 'U') {
            secondstringangle -= 5
            draw();
        } else if (event.key == 'Y') {
            firststringangle -= 5
            draw();
        } else if (event.key == 'T') {
            if (stick2angle > -150)
                stick2angle -= 5
            draw();
        } else if (event.key == 'R') {
            stickangle -= 5
            draw();
        } else if (event.key == 'g' || event.key == 'G') {
            if (touch || grab) {
                grab = !grab;

            }
        }
        // else if (event.key == '1') {
        //     ++x;
        //     console.log(x)
        // } else if (event.key == '2') {
        //     --x;
        //     console.log(x)
        // }


    });
    var tick = function () {
        if (coffinY > 0.0000001) coffinY -= 1;
        coffinY = Math.max(0, coffinY);
        if (botY > 0.0000001) botY -= 1;
        botY = Math.max(0, botY);
        // console.log(botX, botY, botZ);
        draw();
        requestAnimationFrame(tick);
    }
    tick();
}

function drawOffScreen(obj, mdlMatrix, tex) {

    var mvpFromLight = new Matrix4();
    //model Matrix (part of the mvp matrix)
    let modelMatrix = new Matrix4();
    modelMatrix.setIdentity();
    modelMatrix.multiply(mdlMatrix);

    mvpFromLight.setPerspective(150, offScreenWidth / offScreenHeight, 1, 200);
    mvpFromLight.lookAt(lightX, lightY, lightZ, 0, 0, -1 + 0.05, 0, 1, 0);
    // mvpMatrix.lookAt(cameraX, cameraY, cameraZ, 0, 0, 0, 0, 1, 0);
    mvpFromLight.multiply(modelMatrix);

    gl.uniformMatrix4fv(shadowProgram.u_MvpMatrix, false, mvpFromLight.elements);


    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, shadowProgram.a_Position, obj[i].vertexBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices);
    }

    return mvpFromLight;

}


function drawOneObjectOnScreenQUAD(obj, mdl) {
    let mdlMatrix = mdl.matrix
    let mvpFromLight = mdl.mvpFL
    let mvpFromCamera = new Matrix4();
    let tex = mdl.tex
    // console.log(mdlMatrix.elements)
    //model Matrix (part of the mvp matrix)
    let modelMatrix = new Matrix4();
    modelMatrix.setIdentity();
    modelMatrix.multiply(mdlMatrix);
    //mvp: projection * view * model matrix  
    mvpFromCamera.setPerspective(60, 1, 1, 100);
    mvpFromCamera.lookAt(cameraX, cameraY, cameraZ, 0, 0, -1 + 0.05, 0, 1, 0);
    // mvpMatrix.lookAt;
    mvpFromCamera.multiply(modelMatrix);

    //normal matrix
    let normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(modelMatrix);
    normalMatrix.transpose();

    gl.uniform3f(program.u_LightPosition, lightX, lightY, lightZ);
    gl.uniform3f(program.u_ViewPosition, cameraX, cameraY, cameraZ);
    gl.uniform1f(program.u_Ka, 0.2);
    gl.uniform1f(program.u_Kd, 0.7);
    gl.uniform1f(program.u_Ks, 1.0);
    gl.uniform1f(program.u_shininess, 10.0);
    gl.uniform1i(program.u_ShadowMap, 0);
    gl.uniform1i(program.u_Sampler, 1);
    gl.uniform1i(program.u_normalMode, normalMode);



    gl.uniformMatrix4fv(program.u_MvpMatrix, false, mvpFromCamera.elements);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(program.u_normalMatrix, false, normalMatrix.elements);
    gl.uniformMatrix4fv(program.u_MvpMatrixOfLight, false, mvpFromLight.elements);

    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, fboShadow.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, program.a_Position, obj[i].vertexBuffer);
        initAttributeVariable(gl, program.a_TexCoord, obj[i].texCoordBuffer);
        initAttributeVariable(gl, program.a_Normal, obj[i].normalBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices);
    }
}
function drawOneObjectOffScreenQUAD(obj, mdl) {
    let mdlMatrix = mdl.matrix
    let mvpFromLight = mdl.mvpFL
    let mvpFromCamera = new Matrix4();
    let tex = mdl.tex
    // console.log(mdlMatrix.elements)
    //model Matrix (part of the mvp matrix)
    let modelMatrix = new Matrix4();
    modelMatrix.setIdentity();
    modelMatrix.multiply(mdlMatrix);
    //mvp: projection * view * model matrix  
    mvpFromCamera.setPerspective(60, 1, 1, 100);
    mvpFromCamera.lookAt(ScreenX, ScreenY, ScreenZ, 0, 0, -1 + 0.05, 0, 1, 0);
    // mvpMatrix.lookAt;
    mvpFromCamera.multiply(modelMatrix);

    //normal matrix
    let normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(modelMatrix);
    normalMatrix.transpose();

    gl.uniform3f(program.u_LightPosition, lightX, lightY, lightZ);
    gl.uniform3f(program.u_ViewPosition, ScreenX, ScreenY, ScreenZ);
    gl.uniform1f(program.u_Ka, 0.2);
    gl.uniform1f(program.u_Kd, 0.7);
    gl.uniform1f(program.u_Ks, 1.0);
    gl.uniform1f(program.u_shininess, 10.0);
    gl.uniform1i(program.u_ShadowMap, 0);
    gl.uniform1i(program.u_Sampler, 1);
    gl.uniform1i(program.u_normalMode, normalMode);



    gl.uniformMatrix4fv(program.u_MvpMatrix, false, mvpFromCamera.elements);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(program.u_normalMatrix, false, normalMatrix.elements);
    gl.uniformMatrix4fv(program.u_MvpMatrixOfLight, false, mvpFromLight.elements);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures[tex]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboShadow.texture);

    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, program.a_Position, obj[i].vertexBuffer);
        initAttributeVariable(gl, program.a_TexCoord, obj[i].texCoordBuffer);
        initAttributeVariable(gl, program.a_Normal, obj[i].normalBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices);
    }
}

//obj: the object components
//mdlMatrix: the model matrix without mouse rotation
function drawOneObjectOnScreen(obj, mdl) {
    let mdlMatrix = mdl.matrix
    let mvpFromLight = mdl.mvpFL
    let mvpFromCamera = new Matrix4();
    let tex = mdl.tex
    // console.log(mdlMatrix.elements)
    //model Matrix (part of the mvp matrix)
    let modelMatrix = new Matrix4();
    modelMatrix.setIdentity();
    modelMatrix.multiply(mdlMatrix);
    //mvp: projection * view * model matrix  
    mvpFromCamera.setPerspective(60, 1, 1, 100);
    mvpFromCamera.lookAt(cameraX, cameraY, cameraZ, 0, 0, -1 + 0.05, 0, 1, 0);
    // mvpMatrix.lookAt;
    mvpFromCamera.multiply(modelMatrix);

    //normal matrix
    let normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(modelMatrix);
    normalMatrix.transpose();

    gl.uniform3f(program.u_LightPosition, lightX, lightY, lightZ);
    gl.uniform3f(program.u_ViewPosition, cameraX, cameraY, cameraZ);
    gl.uniform1f(program.u_Ka, 0.2);
    gl.uniform1f(program.u_Kd, 0.7);
    gl.uniform1f(program.u_Ks, 1.0);
    gl.uniform1f(program.u_shininess, 10.0);
    gl.uniform1i(program.u_ShadowMap, 0);
    gl.uniform1i(program.u_Sampler, 1);
    gl.uniform1i(program.u_normalMode, normalMode);



    gl.uniformMatrix4fv(program.u_MvpMatrix, false, mvpFromCamera.elements);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(program.u_normalMatrix, false, normalMatrix.elements);
    gl.uniformMatrix4fv(program.u_MvpMatrixOfLight, false, mvpFromLight.elements);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures[tex]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboShadow.texture);

    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, program.a_Position, obj[i].vertexBuffer);
        initAttributeVariable(gl, program.a_TexCoord, obj[i].texCoordBuffer);
        initAttributeVariable(gl, program.a_Normal, obj[i].normalBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices);
    }
}

function calculateMatrix(model, rotate, mat, tex, scaleX, scaleY, scaleZ) {
    if (scaleX == null) scaleX = 1;
    if (scaleY == null) scaleY = 1;
    if (scaleZ == null) scaleZ = 1;
    let o = new Object();
    o.matrix = new Matrix4();
    o.mvpFL = new Matrix4();
    o.matrix.multiply(rotate);
    o.matrix.multiply(mat);
    // console.log(scaleX, scaleY, scaleZ)
    o.matrix.scale(scaleX / 2, scaleY / 2, scaleZ / 2);
    // console.log(o.matrix.elements)
    o.mvpFL = drawOffScreen(model, o.matrix, tex);
    o.tex = tex;
    return o;
}
function draw() {
    // off screen shadow
    // gl.useProgram(program);
    gl.useProgram(shadowProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboShadow);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, offScreenWidth, offScreenHeight);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    //light
    rotateMatrix.setIdentity();//for mouse rotation
    modelMatrix.setTranslate(lightX, lightY, lightZ);

    let lightO = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "LightTex", 0.3, 0.3, 0.3)

    //floor
    rotateMatrix.setRotate(angleY, 1, 0, 0);//for mouse rotation
    rotateMatrix.rotate(angleX, 0, 1, 0);
    modelMatrix.setIdentity();
    modelMatrix.translate(0.0, -1.0, 0);
    let floorO = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "FloorTex", 10, 0.01, 10)

    //bot
    //      body
    modelMatrix.translate(0.0, 0.005, 0);
    modelMatrix.translate(botX, botY / 10, botZ);
    modelMatrix.translate(0, 0.9, 0);
    let bodyO;
    if (touch || grab) {
        bodyO = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "BodyTouchTex", 0.5, 0.6, 0.25)
    } else {
        bodyO = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "BodyTex", 0.5, 0.6, 0.25)

    }
    // console.log(bodyO.matrix.elements)
    //      leg1
    la = (Math.asin(Math.sin(legAngel)) * 180 / Math.PI);
    modelMatrix.translate(-0.125, -0.3, 0);
    modelMatrix.rotate(la, 1, 0, 0);
    modelMatrix.translate(0, -0.3, 0);
    let leg1O = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "LegTex", 0.25, 0.6, 0.25)
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(-la, 1, 0, 0);
    modelMatrix.translate(0, 0.3, 0);
    // console.log(leg1O.matrix.elements)

    modelMatrix.translate(0.25, 0, 0);
    modelMatrix.translate(0, -0.3, 0);
    modelMatrix.rotate(-la, 1, 0, 0);
    modelMatrix.translate(0, -0.3, 0);
    let leg2O = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "LegTex", 0.25, 0.6, 0.25)
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(la, 1, 0, 0);
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.translate(-0.125, 0, 0);

    //      hand
    modelMatrix.translate(-0.375, 0.3, 0);
    modelMatrix.rotate(-la, 1, 0, 0);
    modelMatrix.translate(0, -0.3, 0);
    let hand1O = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "ArmTex", 0.25, 0.6, 0.25)
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(la, 1, 0, 0);
    modelMatrix.translate(0.75, 0, 0);
    modelMatrix.rotate(la, 1, 0, 0);
    modelMatrix.translate(0, -0.3, 0);
    let hand2O = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "ArmTex", 0.25, 0.6, 0.25)
    //      head
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(-la, 1, 0, 0);
    modelMatrix.translate(-0.375, 0.3, 0);
    let headO = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "HeadTex", 0.6, 0.6, 0.6)
    //rod
    //      stick
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(stickangle, 0, 1, 0);
    modelMatrix.rotate(60 + stick2angle, -1, 0, 0);
    modelMatrix.translate(0, 0.8, 0);
    let stickO = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "RodTex", 0.1, 1.6, 0.1)
    //      string
    modelMatrix.translate(0, 0.8, 0);
    modelMatrix.rotate(stick2angle, 11, 0, 0);
    modelMatrix.rotate(30 + 90, -1, 0, 0);
    modelMatrix.rotate(firststringangle, 1, 0, 0);
    modelMatrix.translate(0, 0.4, 0);
    let string1O = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "StringTex", 0.01, 0.8, 0.01)
    modelMatrix.translate(0, 0.4, 0);
    modelMatrix.rotate(secondstringangle, -1, 0, 0);
    modelMatrix.translate(0, 0.4, 0);
    let string2O = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "StringTex", 0.01, 0.8, 0.01)
    //      buoy
    modelMatrix.translate(0, 0.4, 0);
    modelMatrix.rotate(firststringangle - secondstringangle, -1, 0, 0);
    let buoyO = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "BuoyTex", 0.1, 0.1, 0.1)
    loc = modelMatrix.multiplyVector4(new Vector4([0, 0, 0, 1]))
    //move star to buoy
    if (grab) {
        coffinX = loc.elements[0];
        coffinY = loc.elements[1] * 10 + 5;
        coffinZ = loc.elements[2] + 1;
    }
    modelMatrix.setIdentity();
    modelMatrix.translate(0.0, -1.0, 0);
    modelMatrix.translate(0.0, 0.25, 0);
    modelMatrix.translate(coffinX, coffinY / 10, coffinZ);
    loc2 = modelMatrix.multiplyVector4(new Vector4([0, 0, -1, 1]))
    let dx = Math.abs(loc.elements[0] - loc2.elements[0])
    let dy = Math.abs(loc.elements[1] - loc2.elements[1])
    let dz = Math.abs(loc.elements[2] - loc2.elements[2])
    let dis_square = dx * dx + dy * dy + dz * dz
    // console.log(dx, dy, dz)
    if (dx <= 0.45 + 0.05 && dy <= 0.25 + 0.05 && dz <= 1 + 0.05) {
        touch = 1;
    } else {
        touch = 0;
    }
    let coffinO;
    coffinO = calculateMatrix(coffinObj, rotateMatrix, modelMatrix, "coffinTex", 0.5, 0.5, 0.5)
    modelMatrix.setTranslate(5.5, 4, 0);
    tvO = calculateMatrix(cubeObj, rotateMatrix, modelMatrix, "tvTex", 1, 10, 10)
    // if (touch || grab) {

    // } else {
    //     starO = calculateMatrix(starObj, rotateMatrix, modelMatrix, "coffinTex", 0.5, 0.5, 0.5)

    // }
    // on screen
    gl.useProgram(program);
    /*drawOffScreenQUAD */
    // light box
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, offScreenWidth, offScreenHeight);
    gl.clearColor(0.4, 0.4, 0.4, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    drawOneObjectOffScreenQUAD(cubeObj, lightO);
    // floor
    drawOneObjectOffScreenQUAD(cubeObj, floorO);
    //bot
    drawOneObjectOffScreenQUAD(cubeObj, bodyO);
    drawOneObjectOffScreenQUAD(cubeObj, leg1O);
    drawOneObjectOffScreenQUAD(cubeObj, leg2O);
    drawOneObjectOffScreenQUAD(cubeObj, hand1O);
    drawOneObjectOffScreenQUAD(cubeObj, hand2O);
    drawOneObjectOffScreenQUAD(cubeObj, headO);
    drawOneObjectOffScreenQUAD(cubeObj, stickO);
    drawOneObjectOffScreenQUAD(cubeObj, string1O);
    drawOneObjectOffScreenQUAD(cubeObj, string2O);
    drawOneObjectOffScreenQUAD(cubeObj, buoyO);
    drawOneObjectOffScreenQUAD(coffinObj, coffinO);
    drawOneObjectOffScreenQUAD(cubeObj, tvO);
    if (normalMode) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.4, 0.4, 0.4, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        // light box
        drawOneObjectOnScreen(cubeObj, lightO);
        // floor
        drawOneObjectOnScreen(cubeObj, floorO);
        //bot
        drawOneObjectOnScreen(cubeObj, bodyO);
        drawOneObjectOnScreen(cubeObj, leg1O);
        drawOneObjectOnScreen(cubeObj, leg2O);
        drawOneObjectOnScreen(cubeObj, hand1O);
        drawOneObjectOnScreen(cubeObj, hand2O);
        drawOneObjectOnScreen(cubeObj, headO);
        drawOneObjectOnScreen(cubeObj, stickO);
        drawOneObjectOnScreen(cubeObj, string1O);
        drawOneObjectOnScreen(cubeObj, string2O);
        drawOneObjectOnScreen(cubeObj, buoyO);
        drawOneObjectOnScreen(coffinObj, coffinO);
        drawOneObjectOnScreenQUAD(cubeObj, tvO);
        // drawOneObjectOnScreenQUAD(coffinObj, coffinO);
    } else {
        //draw the shadow map (the quad)
        //active the quadProgram
        gl.useProgram(quadProgram);
        //switch the destination back to normal canvas color buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        //pass fbo.texture into the quadProgram
        //draw the quad
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fboShadow.texture)
        // gl.activeTexture(gl.TEXTURE_2D, fbo.texture)
        gl.uniform1i(quadProgram.u_ShadowMap, 0)
        initAttributeVariable(gl, quadProgram.a_Position, quadObj.vertexBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, 6)

    }

}








function mouseDown(ev) {
    var x = ev.clientX;
    var y = ev.clientY;
    var rect = ev.target.getBoundingClientRect();
    if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
        mouseLastX = x;
        mouseLastY = y;
        mouseDragging = true;
    }
}

function mouseUp(ev) {
    mouseDragging = false;
}

function mouseMove(ev) {
    var x = ev.clientX;
    var y = ev.clientY;
    if (mouseDragging) {
        var factor = 100 / canvas.height; //100 determine the spped you rotate the object
        var dx = factor * (x - mouseLastX);
        var dy = factor * (y - mouseLastY);

        angleX += dx; //yes, x for y, y for x, this is right
        angleY += dy;
    }
    mouseLastX = x;
    mouseLastY = y;

    draw();
}

function scroll(ev) {
    // console.log(ev.wheelDelta)
    if (ev.wheelDelta < 0) {
        cameraX += 0.3;
        cameraY += 0.3;
        cameraZ += 0.7;
        // ++cameradis;
    } else {
        cameraX -= 0.3;
        cameraY -= 0.3;
        cameraZ -= 0.7;
        // --cameradis;
    }
}

function initTexture(gl, img, texKey) {
    var tex = gl.createTexture();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.bindTexture(gl.TEXTURE_2D, tex);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    textures[texKey] = tex;

    texCount++;
    if (texCount == numTextures) draw();
}


function initFrameBuffer(gl) {
    //create and set up a texture object as the color buffer

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, offScreenWidth, offScreenHeight,
        0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);


    //create and setup a render buffer as the depth buffer
    var depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
        offScreenWidth, offScreenHeight);

    //create and setup framebuffer: linke the color and depth buffer to it
    var frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
        gl.RENDERBUFFER, depthBuffer);
    frameBuffer.texture = texture;
    return frameBuffer;
}

function parseOBJ(text) {
    // because indices are base 1 let's just fill in the 0th data
    const objPositions = [[0, 0, 0]];
    const objTexcoords = [[0, 0]];
    const objNormals = [[0, 0, 0]];

    // same order as `f` indices
    const objVertexData = [
        objPositions,
        objTexcoords,
        objNormals,
    ];

    // same order as `f` indices
    let webglVertexData = [
        [],   // positions
        [],   // texcoords
        [],   // normals
    ];

    const materialLibs = [];
    const geometries = [];
    let geometry;
    let groups = ['default'];
    let material = 'default';
    let object = 'default';

    const noop = () => { };

    function newGeometry() {
        // If there is an existing geometry and it's
        // not empty then start a new one.
        if (geometry && geometry.data.position.length) {
            geometry = undefined;
        }
    }

    function setGeometry() {
        if (!geometry) {
            const position = [];
            const texcoord = [];
            const normal = [];
            webglVertexData = [
                position,
                texcoord,
                normal,
            ];
            geometry = {
                object,
                groups,
                material,
                data: {
                    position,
                    texcoord,
                    normal,
                },
            };
            geometries.push(geometry);
        }
    }

    function addVertex(vert) {
        const ptn = vert.split('/');
        ptn.forEach((objIndexStr, i) => {
            if (!objIndexStr) {
                return;
            }
            const objIndex = parseInt(objIndexStr);
            const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
            webglVertexData[i].push(...objVertexData[i][index]);
        });
    }

    const keywords = {
        v(parts) {
            objPositions.push(parts.map(parseFloat));
        },
        vn(parts) {
            objNormals.push(parts.map(parseFloat));
        },
        vt(parts) {
            // should check for missing v and extra w?
            // console.log(text)
            // if (text == './Coffin.obj')
            //     console.log(parts.map(parseFloat))
            objTexcoords.push(parts.map(parseFloat));
        },
        f(parts) {
            setGeometry();
            const numTriangles = parts.length - 2;
            for (let tri = 0; tri < numTriangles; ++tri) {
                addVertex(parts[0]);
                addVertex(parts[tri + 1]);
                addVertex(parts[tri + 2]);
            }
        },
        s: noop,    // smoothing group
        mtllib(parts, unparsedArgs) {
            // the spec says there can be multiple filenames here
            // but many exist with spaces in a single filename
            materialLibs.push(unparsedArgs);
        },
        usemtl(parts, unparsedArgs) {
            material = unparsedArgs;
            newGeometry();
        },
        g(parts) {
            groups = parts;
            newGeometry();
        },
        o(parts, unparsedArgs) {
            object = unparsedArgs;
            newGeometry();
        },
    };

    const keywordRE = /(\w*)(?: )*(.*)/;
    const lines = text.split('\n');
    for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
        const line = lines[lineNo].trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        const m = keywordRE.exec(line);
        if (!m) {
            continue;
        }
        const [, keyword, unparsedArgs] = m;
        const parts = line.split(/\s+/).slice(1);
        const handler = keywords[keyword];
        if (!handler) {
            console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
            continue;
        }
        handler(parts, unparsedArgs);
    }

    // remove any arrays that have no entries.
    for (const geometry of geometries) {
        geometry.data = Object.fromEntries(
            Object.entries(geometry.data).filter(([, array]) => array.length > 0));
    }

    return {
        geometries,
        materialLibs,
    };
}
