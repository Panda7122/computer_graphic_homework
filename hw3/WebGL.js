var VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec4 a_Color;
    attribute vec4 a_Normal;
    uniform mat4 u_MvpMatrix;
    uniform mat4 u_modelMatrix;
    uniform mat4 u_normalMatrix;
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    varying vec4 v_Color;
    void main(){
        gl_Position = u_MvpMatrix * a_Position; // Transform a_Position to clip space
        v_PositionInWorld = (u_modelMatrix * a_Position).xyz; // Transform a_Position to world space
        v_Normal = normalize((u_normalMatrix * a_Normal).xyz); // Transform a_Normal to world space and renormalize
        v_Color = a_Color; // Set a_Color to v_Color
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
    varying vec3 v_Normal;
    varying vec3 v_PositionInWorld;
    varying vec4 v_Color;
    void main(){
        // let ambient and diffuse color are v_Color 
        // (you can also input them from ouside and make them different)
        vec3 ambientLightColor = v_Color.rgb;
        vec3 diffuseLightColor = v_Color.rgb;
        // assume white specular light (you can also input it from ouside)
        vec3 specularLightColor = vec3(1.0, 1.0, 1.0);        

        // calculate ambient light color using "ambientLightColor" and "u_Ka"
        vec3 ambient = ambientLightColor * u_Ka;
        
        vec3 normal = normalize(v_Normal); //normalize the v_Normal before using it, before it comes from normal vectors interpolation
        // calculate diffuse light color using "normal", "u_LightPosition", "v_PositionInWorld", "diffuseLightColor", and "u_Kd"
        vec3 lightDirection = normalize(u_LightPosition - v_PositionInWorld);
        float nDotL = max(dot(normal, lightDirection), 0.0);
        vec3 diffuse = diffuseLightColor * u_Kd * nDotL;
        
        vec3 specular = vec3(0.0, 0.0, 0.0); 
        if(nDotL > 0.0) {
            // calculate specular light color using "normal", "u_LightPosition", "v_PositionInWorld", 
            // "u_ViewPosition", "u_shininess", "specularLightColor", and "u_Ks"
            vec3 viewDirection = normalize(u_ViewPosition - v_PositionInWorld);
            vec3 reflectDirection = reflect(-lightDirection, normal);
            float specularFactor = pow(max(dot(reflectDirection, viewDirection), 0.0), u_shininess);
            specular = specularLightColor * u_Ks * specularFactor;
        }

        // sum up ambient, diffuse, specular light color from above calculation and put them into "gl_FragColor"
        gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
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

var mouseLastX, mouseLastY;
var mouseDragging = false;
var angleX = 0, angleY = 0;
var gl, canvas;
var mvpMatrix;
var modelMatrix;
var normalMatrix;
var rotateMatrix;
var headModel;
var bodyModel;
var legModel;
var lightModel;
var floorModel;
var blockModel;
var blocktouchModel;
var blockhandModel;
var blockeyeModel;
var blockeyetouchModel;
var hookModel;
var botX = 0, botY = 0, botZ = 0;
var lightX = 0, lightY = 5, lightZ = 0;
// var cameradis = 10;
var cameraX = 3;
var cameraY = 3;
var cameraZ = 7;
function makeRectangleVertice(verticesArr, l, w, h) {
    var L = l / 2
    var W = w / 2
    var H = h / 2
    // console.log(l, w, h);
    // console.log(L, W, H);
    verticesArr.push(L, H, W, -L, H, W, -L, -H, W, L, H, W, -L, -H, W, L, -H, W, //front
        L, H, W, L, -H, W, L, -H, -W, L, H, W, L, -H, -W, L, H, -W, //right
        L, H, W, L, H, -W, -L, H, -W, L, H, W, -L, H, -W, -L, H, W, //up
        -L, H, W, -L, -H, -W, -L, -H, W, -L, -H, -W, -L, H, -W, -L, H, W, //left
        -L, -H, W, -L, -H, -W, L, -H, -W, L, -H, -W, L, -H, W, -L, -H, W, //bottom
        L, -H, -W, -L, -H, -W, -L, H, -W, L, -H, -W, -L, H, -W, L, H, -W //back
    );

}
function makeNormal(normalArr, vertices, faceSize) {
    var sz = vertices.length / (3 * faceSize);
    // console.log(vertices.length);
    for (var i = 0; i < faceSize; ++i) {
        // console.log(i * 3 * sz);
        var x1 = vertices[i * 3 * sz];
        var y1 = vertices[i * 3 * sz + 1];
        var z1 = vertices[i * 3 * sz + 2];
        var x2 = vertices[i * 3 * sz + 3] - x1;
        var y2 = vertices[i * 3 * sz + 3 + 1] - y1;
        var z2 = vertices[i * 3 * sz + 3 + 2] - z1;
        var x3 = vertices[i * 3 * sz + 6] - x1;
        var y3 = vertices[i * 3 * sz + 6 + 1] - y1;
        var z3 = vertices[i * 3 * sz + 6 + 2] - z1;
        var x = y2 * z3 - y3 * z2, y = z2 * x3 - z3 * x2, z = x2 * y3 - x3 * y2;
        // console.log(vertices);
        // console.log("1:", i * 3 * sz, x1, y1, z1);
        // console.log("2:", i * 3 * sz + 3, x2, y2, z2, "(", x2 + x1, y2 + y1, z2 + z1, ")");
        // console.log("3:", i * 3 * sz + 6, x3, y3, z3, "(", x3 + x1, y3 + y1, z3 + z1, ")");
        // console.log("cross:", x, y, z);
        var mx = Math.max(Math.abs(x), Math.max(Math.abs(y), Math.abs(z)));
        if (mx == 0) return -1;
        x /= mx;
        y /= mx;
        z /= mx;
        // console.log("normal:", x, y, z);
        for (var j = 0; j < sz; ++j) {
            // console.log(i, j);
            normalArr.push(x, y, z);
        }
        // console.log(normalArr);
    }
}
function makeColor(colorArr, vertices, color, faceSize) {
    // console.log(color);
    var sz = vertices.length / (3 * faceSize);
    for (var i = 0; i < faceSize; ++i) {
        for (var j = 0; j < sz; ++j) {
            for (var k = 0; k < 3; ++k) {
                colorArr.push(color[i][k]);
            }
        }
    }
}
var stickvertices = [];
var stickcolors = [];
var sticknormals = [];
var stringvertices = [];
var stringcolors = [];
var stringnormals = [];
var bodyvertices = [];
var bodycolors = [];
var bodynormals = [];
var floorvertices = [];
var floorcolors = [];
var floornormals = [];
var lightvertices = [];
var lightcolors = [];
var lightnormals = [];
var legvertices = [];
var legcolors = [];
var legnormals = [];
var headvertices = [];
var headcolors = [];
var headnormals = [];
var hookvertices = [];
var hookcolors = [];
var hooknormals = [];
var blockvertices = [];
var blockcolors = [];
var blocktouchcolors = [];
var blocknormals = [];
var blockhandvertices = [];
var blockhandcolors = [];
var blockhandnormals = [];
var blockeyevertices = [];
var blockeyecolors = [];
var blockeyetouchcolors = [];
var blockeyenormals = [];
var legAngel = 0;
var firststringangle = 0;
var secondstringangle = 0;
var stickangle = 0;
var stick2angle = 0;
var bhangle = 45;
var bh2angle = 0;
var touch = 0;
var grab = 0;
var blockX, blockY, blockZ;
function main() {
    canvas = document.getElementById('webgl');
    gl = canvas.getContext('webgl2');
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    program = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);

    gl.useProgram(program);
    program.a_Position = gl.getAttribLocation(program, 'a_Position');
    program.a_Color = gl.getAttribLocation(program, 'a_Color');
    program.a_Normal = gl.getAttribLocation(program, 'a_Normal')
    program.u_MvpMatrix = gl.getUniformLocation(program, 'u_MvpMatrix');
    program.u_modelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');
    program.u_normalMatrix = gl.getUniformLocation(program, 'u_normalMatrix');
    program.u_LightPosition = gl.getUniformLocation(program, 'u_LightPosition');
    program.u_ViewPosition = gl.getUniformLocation(program, 'u_ViewPosition');
    program.u_Ka = gl.getUniformLocation(program, 'u_Ka');
    program.u_Kd = gl.getUniformLocation(program, 'u_Kd');
    program.u_Ks = gl.getUniformLocation(program, 'u_Ks');
    program.u_shininess = gl.getUniformLocation(program, 'u_shininess');

    makeRectangleVertice(lightvertices, 0.3, 0.3, 0.3);
    makeRectangleVertice(headvertices, 0.6, 0.6, 0.6);
    makeRectangleVertice(bodyvertices, 0.5, 0.25, 0.6);
    // makeRectangleVertice(floorvertices, 100, 100, 0.01);
    makeRectangleVertice(floorvertices, 30, 30, 0.01);
    makeRectangleVertice(legvertices, 0.25, 0.25, 0.6);
    makeRectangleVertice(stickvertices, 0.1, 0.1, 1.6);
    makeRectangleVertice(stringvertices, 0.01, 0.01, 0.6);
    makeRectangleVertice(blockvertices, 1, 1, 1);
    makeRectangleVertice(hookvertices, 0.1, 0.1, 0.1);
    makeRectangleVertice(blockhandvertices, 0.1, 0.1, 0.3);
    makeRectangleVertice(blockeyevertices, 0.2, 0.2, 0.2);
    blockX = Math.random() * 10 - 5;
    // blockX = 0;
    blockY = Math.random();
    blockZ = Math.random() * 10 - 5;
    // blockZ = 0;s
    // console.log(bodyvertices);
    makeColor(lightcolors, lightvertices, [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], 6);
    makeColor(bodycolors, bodyvertices, [[0.4, 0.4, 1.0], [0.4, 1.0, 0.4], [1.0, 0.4, 0.4], [1.0, 0.4, 1.0], [1.0, 1.0, 0.4], [0.4, 1.0, 1.0]], 6);
    makeColor(legcolors, legvertices, [[0.9, 0.72, 0.67], [0.9, 0.72, 0.67], [0.9, 0.72, 0.67], [0.9, 0.72, 0.67], [0.9, 0.72, 0.67], [0.9, 0.72, 0.67]], 6);
    makeColor(headcolors, legvertices, [[0.9, 0.72, 0.67], [0.9, 0.72, 0.67], [0.1, 0.1, 0.1], [0.9, 0.72, 0.67], [0.9, 0.72, 0.67], [0.8, 0.8, 0.8]], 6);
    makeColor(floorcolors, floorvertices, [[0.0, 0.50, 0.37], [0.0, 0.50, 0.37], [0.0, 0.50, 0.37], [0.0, 0.50, 0.37], [0.0, 0.50, 0.37], [0.0, 0.50, 0.37]], 6);
    makeColor(stickcolors, stickvertices, [[0.26, 0.16, 0.09], [0.26, 0.16, 0.09], [0.26, 0.16, 0.09], [0.26, 0.16, 0.09], [0.26, 0.16, 0.09], [0.26, 0.16, 0.09]], 6);
    makeColor(stringcolors, stringvertices, [[0.8, 0.8, 0.8], [0.8, 0.8, 0.8], [0.8, 0.8, 0.8], [0.8, 0.8, 0.8], [0.8, 0.8, 0.8], [0.8, 0.8, 0.8]], 6);
    makeColor(hookcolors, hookvertices, [[1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]], 6);
    makeColor(blockcolors, blockvertices, [[0.7, 0.3, 1], [0.7, 0.3, 1], [0.7, 0.3, 1], [0.7, 0.3, 1], [0.7, 0.3, 1], [0.7, 0.3, 1]], 6);
    makeColor(blocktouchcolors, blockvertices, [[0.7, 0.3, 1], [0.7, 0.3, 1], [0.0, 0.62, 0.72], [0.7, 0.3, 1], [0.7, 0.3, 1], [0.7, 0.3, 1]], 6);
    makeColor(blockhandcolors, blockhandvertices, [[0.8, 0.4, 1], [0.8, 0.4, 1], [0.8, 0.4, 1], [0.8, 0.4, 1], [0.8, 0.4, 1], [0.8, 0.4, 1]], 6);
    makeColor(blockeyecolors, blockeyevertices, [[0.2, 0.2, 0.2], [0.2, 0.2, 0.2], [0.2, 0.2, 0.2], [0.2, 0.2, 0.2], [0.2, 0.2, 0.2], [0.2, 0.2, 0.2]], 6);
    makeColor(blockeyetouchcolors, blockeyevertices, [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], 6);

    // console.log(bodycolors);
    if (makeNormal(lightnormals, lightvertices, 6) == -1) { console.log('light normal error\n'); return; }
    if (makeNormal(bodynormals, bodyvertices, 6) == -1) { console.log('body normal error\n'); return; }
    if (makeNormal(headnormals, bodyvertices, 6) == -1) { console.log('head normal error\n'); return; }
    if (makeNormal(legnormals, bodyvertices, 6) == -1) { console.log('leg normal error\n'); return; }
    if (makeNormal(floornormals, floorvertices, 6) == -1) { console.log('floor normal error\n'); return; }
    if (makeNormal(sticknormals, stickvertices, 6) == -1) { console.log('stick normal error\n'); return; }
    if (makeNormal(stringnormals, stringvertices, 6) == -1) { console.log('string normal error\n'); return; }
    if (makeNormal(hooknormals, hookvertices, 6) == -1) { console.log('hook normal error\n'); return; }
    if (makeNormal(blockhandnormals, blockhandvertices, 6) == -1) { console.log('block\'s hand normal error\n'); return; }
    if (makeNormal(blockeyenormals, blockeyevertices, 6) == -1) { console.log('block\s eyes normal error\n'); return; }
    // console.log(bodynormals);
    bodyModel = initVertexBufferForLaterUse(gl, bodyvertices, bodycolors, bodynormals);
    headModel = initVertexBufferForLaterUse(gl, headvertices, headcolors, headnormals);
    legModel = initVertexBufferForLaterUse(gl, legvertices, legcolors, legnormals);
    floorModel = initVertexBufferForLaterUse(gl, floorvertices, floorcolors, floornormals);
    lightModel = initVertexBufferForLaterUse(gl, lightvertices, lightcolors, lightnormals);
    stickModel = initVertexBufferForLaterUse(gl, stickvertices, stickcolors, sticknormals);
    stringModel = initVertexBufferForLaterUse(gl, stringvertices, stringcolors, stringnormals);
    hookModel = initVertexBufferForLaterUse(gl, hookvertices, hookcolors, hooknormals);
    blockModel = initVertexBufferForLaterUse(gl, blockvertices, blockcolors, blocknormals);
    blocktouchModel = initVertexBufferForLaterUse(gl, blockvertices, blocktouchcolors, blocknormals);
    blockhandModel = initVertexBufferForLaterUse(gl, blockhandvertices, blockhandcolors, blockhandnormals);
    blockeyeModel = initVertexBufferForLaterUse(gl, blockeyevertices, blockeyecolors, blockeyenormals);
    blockeyetouchModel = initVertexBufferForLaterUse(gl, blockeyevertices, blockeyetouchcolors, blockeyenormals);

    mvpMatrix = new Matrix4();
    modelMatrix = new Matrix4();
    normalMatrix = new Matrix4();
    rotateMatrix = new Matrix4();
    gl.enable(gl.DEPTH_TEST);

    // draw();//draw it once before mouse move

    canvas.onmousedown = function (ev) { mouseDown(ev) };
    canvas.onmousemove = function (ev) { mouseMove(ev) };
    canvas.onmouseup = function (ev) { mouseUp(ev) };
    canvas.onwheel = function (ev) { scroll(ev) };
    document.addEventListener('keydown', (event) => {
        if (event.key == 'j') {

            bhangle += 5;

            draw();
        } else if (event.key == 'J') {

            bhangle -= 5;

            draw();
        } else if (event.key == 'k') {
            bh2angle += 5;
            draw();
        } else if (event.key == 'K') {
            bh2angle -= 5;
            draw();
        } else if (event.key == 'w' || event.key == 'W') {
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

        // if (event.keyCode == 38) {
        //     console.log('up')
        //     cameraZ++;
        // }
        // if (event.keyCode == 37) {
        //     console.log('left')
        //     cameraX--;
        // }
        // if (event.keyCode == 39) {
        //     console.log('right')
        //     cameraX++;
        // }
        // if (event.keyCode == 40) {
        //     console.log('down')
        //     cameraZ--;
        // }
    });
    var tick = function () {
        if (!grab && blockY > 0.0000001) blockY -= 0.05;
        blockY = Math.max(0, blockY);
        if (botY > 0.0000001) botY -= 1;
        botY = Math.max(0, botY);
        // console.log(botX, botY, botZ);
        draw();
        requestAnimationFrame(tick);
    }
    tick();
}
function putObj(model, matrix) {
    // console.log(model.vertexBuffer);
    // console.log(model.colorBuffer);
    // console.log(model.normalBuffer);
    initAttributeVariable(gl, program.a_Position, model.vertexBuffer);//set triangle  vertex to shader varibale
    initAttributeVariable(gl, program.a_Color, model.colorBuffer);
    initAttributeVariable(gl, program.a_Normal, model.normalBuffer);
    //mvp: projection * view * model matrix  
    m = new Matrix4();
    m.setIdentity();
    m.multiply(rotateMatrix);
    m.multiply(matrix);
    // cam = new Matrix4();
    // cam.setIdentity();
    // cam.translate(botX, botY, botZ);
    // cam.rotate(angleY, -1, 0, 0);//for mouse rotation
    // cam.rotate(angleX, 0, 1, 0);
    // cam.translate(cameradis, 0, 0);
    // cam.translate(cameraX, cameraY, cameraZ);
    // cam.multiply(rotateMatrix);
    // loc = cam.multiplyVector4(new Vector4([0, 0, 0, 1]));
    // console.log(botX, botY, botZ);
    // loc = matrix.multiplyVector4(new Vector4([botX, , 1, 1]));
    // cameraX = loc.elements[0];
    // cameraY = loc.elements[1];
    // cameraZ = loc.elements[2];
    // console.log(cameraX, cameraY, cameraZ);
    mvpMatrix.setPerspective(30, 1, 1, 100);
    // mvpMatrix.lookAt(cameraX, cameraY, cameraZ, botX, botY, botZ, botX, botY + 2, botZ);
    // mvpMatrix.lookAt(cameraX, cameraY, cameraZ, loc.elements[0], loc.elements[1], loc.elements[2], 0, 1, 0);
    mvpMatrix.lookAt(cameraX, cameraY, cameraZ, 0, 0, -1 + 0.05, 0, 1, 0);
    mvpMatrix.multiply(m);

    //normal matrix
    normalMatrix.setInverseOf(m);
    normalMatrix.transpose();
    // loc = rotateMatrix.multiplyVector4(new Vector4([cameraX, cameraY, cameraZ, 1]));
    gl.uniform3f(program.u_LightPosition, lightX, lightY, lightZ);
    gl.uniform3f(program.u_ViewPosition, cameraX, cameraY, cameraZ);
    // gl.uniform3f(program.u_ViewPosition, loc.elements[0], loc.elements[1], loc.elements[2]);
    gl.uniform1f(program.u_Ka, 0.2);
    gl.uniform1f(program.u_Kd, 0.7);
    gl.uniform1f(program.u_Ks, 1.0);
    gl.uniform1f(program.u_shininess, 10.0);


    gl.uniformMatrix4fv(program.u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, m.elements);
    // gl.uniformMatrix4fv(program.u_modelMatrix, false, matrix.elements);
    gl.uniformMatrix4fv(program.u_normalMatrix, false, normalMatrix.elements);
    // console.log(vertexModel.numVertices);
    gl.drawArrays(gl.TRIANGLES, 0, model.numVertices);
}
function draw() {
    console.log(secondstringangle)
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //model Matrix (part of the mvp matrix)
    rotateMatrix.setIdentity();//for mouse rotation
    modelMatrix.setTranslate(lightX, lightY, lightZ);
    putObj(lightModel, modelMatrix);
    // modelMatrix.translate(0.0, 0.0, -3.0);
    // modelMatrix.setRotate(angleY, 1, 0, 0);//for mouse rotation
    // modelMatrix.rotate(angleX, 0, 1, 0);//for mouse rotation
    rotateMatrix.setRotate(angleY, 1, 0, 0);//for mouse rotation
    rotateMatrix.rotate(angleX, 0, 1, 0);
    modelMatrix.setIdentity();
    modelMatrix.translate(0.0, -1.0, 0);
    putObj(floorModel, modelMatrix);
    // modelMatrix.translate(0.0, 1.0, 0);
    modelMatrix.translate(0.0, 0.005, 0);
    // modelMatrix.rotate(angleX, 0, 1, 0);//for mouse rotation
    modelMatrix.translate(botX, botY / 10, botZ);
    modelMatrix.translate(0, 0.9, 0);
    putObj(bodyModel, modelMatrix);

    la = (Math.asin(Math.sin(legAngel)) * 180 / Math.PI);
    modelMatrix.translate(-0.125, -0.3, 0);
    modelMatrix.rotate(la, 1, 0, 0);
    modelMatrix.translate(0, -0.3, 0);
    putObj(legModel, modelMatrix);
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(-la, 1, 0, 0);

    modelMatrix.translate(0.25, 0, 0);
    modelMatrix.rotate(-la, 1, 0, 0);
    modelMatrix.translate(0, -0.3, 0);
    putObj(legModel, modelMatrix);
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(la, 1, 0, 0);
    modelMatrix.translate(-0.125, 0.3, 0);


    modelMatrix.translate(-0.375, 0.3, 0);
    modelMatrix.rotate(-la, 1, 0, 0);
    modelMatrix.translate(0, -0.3, 0);
    putObj(legModel, modelMatrix);
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(la, 1, 0, 0);
    modelMatrix.translate(0.75, 0, 0);
    modelMatrix.rotate(la, 1, 0, 0);
    modelMatrix.translate(0, -0.3, 0);
    putObj(legModel, modelMatrix);
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(-la, 1, 0, 0);

    modelMatrix.translate(-0.375, 0.3, 0);
    putObj(headModel, modelMatrix);
    modelMatrix.translate(0, 0.3, 0);

    modelMatrix.rotate(stickangle, 0, 1, 0);
    modelMatrix.rotate(60 + stick2angle, -1, 0, 0);
    modelMatrix.translate(0, 0.8, 0);
    putObj(stickModel, modelMatrix);
    modelMatrix.translate(0, 0.8, 0);
    modelMatrix.rotate(stick2angle, 11, 0, 0);
    modelMatrix.rotate(30 + 90, -1, 0, 0);
    modelMatrix.rotate(firststringangle, 1, 0, 0);
    modelMatrix.translate(0, 0.3, 0);
    putObj(stringModel, modelMatrix);
    modelMatrix.translate(0, 0.3, 0);
    // modelMatrix.rotate(-firststringangle, 1, 0, 0);
    modelMatrix.rotate(secondstringangle, -1, 0, 0);
    modelMatrix.translate(0, 0.3, 0);
    putObj(stringModel, modelMatrix);
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(firststringangle - secondstringangle, -1, 0, 0);
    putObj(hookModel, modelMatrix);
    loc = modelMatrix.multiplyVector4(new Vector4([0, 0, 0, 1]))
    // console.log("hook", loc.elements);
    // console.log("block", blockX, blockY, blockZ);
    if (grab) {
        blockX = loc.elements[0];
        blockY = loc.elements[1];
        blockZ = loc.elements[2];
    }
    // console.log(loc.elements[0] - blockX, loc.elements[1] - blockY, loc.elements[2] - blockZ)
    // modelMatrix.setRotate(angleY, 1, 0, 0);//for mouse rotation
    // modelMatrix.rotate(angleX, 0, 1, 0);
    modelMatrix.setIdentity();
    modelMatrix.translate(0.0, -1.0, 0);
    modelMatrix.translate(0.0, 0.505, 0);
    modelMatrix.translate(blockX, blockY, blockZ);
    loc2 = modelMatrix.multiplyVector4(new Vector4([0, 0, 0, 1]))
    var bx = loc2.elements[0];
    var by = loc2.elements[1];
    var bz = loc2.elements[2];
    if (Math.abs(loc.elements[0] - bx) <= 0.5 + 0.05 && Math.abs(loc.elements[1] - by) <= 0.5 + 0.05 && Math.abs(loc.elements[2] - bz) <= 0.5 + 0.05) {
        touch = 1;
    } else {
        touch = 0;
    }
    if (touch || grab)
        putObj(blocktouchModel, modelMatrix);
    else
        putObj(blockModel, modelMatrix);
    modelMatrix.translate(0, 0, 0.5);
    modelMatrix.translate(0, 0.15, 0);
    modelMatrix.rotate(bhangle, -1, 0, 0);
    modelMatrix.translate(0, -0.15, 0);
    putObj(blockhandModel, modelMatrix);
    modelMatrix.translate(0, -0.15, 0);
    modelMatrix.rotate(bh2angle, -1, 0, 0);
    modelMatrix.translate(0, -0.15, 0);
    putObj(blockhandModel, modelMatrix);

    modelMatrix.translate(0, 0.15, 0);
    modelMatrix.rotate(bh2angle, 1, 0, 0);
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(bhangle, 1, 0, 0);
    modelMatrix.translate(0, 0, -0.5);
    modelMatrix.translate(0, -0.15, -0.5);
    // modelMatrix.translate(0, 0, -0.25);
    modelMatrix.translate(0, 0.15, 0);

    modelMatrix.rotate(bhangle, 1, 0, 0);
    modelMatrix.translate(0, -0.15, 0);
    putObj(blockhandModel, modelMatrix);
    modelMatrix.translate(0, -0.15, 0);
    modelMatrix.rotate(bh2angle, 1, 0, 0);
    modelMatrix.translate(0, -0.15, 0);
    putObj(blockhandModel, modelMatrix);
    // if (touch) {

    // modelMatrix.translate(0, 0.15, 0);
    // }
    modelMatrix.translate(0, 0.15, 0);
    modelMatrix.rotate(bh2angle, -1, 0, 0);
    modelMatrix.translate(0, 0.3, 0);
    modelMatrix.rotate(bhangle, -1, 0, 0);
    modelMatrix.translate(-0.5, 0.1, 0.3);
    // modelMatrix.translate(0, -0.15, 0);
    if (touch || grab) {
        putObj(blockeyetouchModel, modelMatrix);

    } else {
        // console.log("no touch");
        putObj(blockeyeModel, modelMatrix);
    }
    modelMatrix.translate(0, 0, 0.4);
    if (touch || grab) {
        putObj(blockeyetouchModel, modelMatrix);

    } else {
        // console.log("no touch");
        putObj(blockeyeModel, modelMatrix);
    }
    // } else {
    //     putObj(blockModel, modelMatrix);
    // }

    // modelMatrix.translate(0.0, 1.0, 0);
    // modelMatrix.scale(1.0, 0.5, 2.0);
    // console.log(modelMatrix)
    // modelMatrix.translate(-3.1, 0.0, 0.0);
    // putObj(vertexModel, modelMatrix);

}

function initVertexBufferForLaterUse(gl, vertices, colors, normals) {
    var nVertices = vertices.length / 3;

    var o = new Object();
    o.vertexBuffer = initArrayBufferForLaterUse(gl, new Float32Array(vertices), 3, gl.FLOAT);
    o.colorBuffer = initArrayBufferForLaterUse(gl, new Float32Array(colors), 3, gl.FLOAT);
    o.normalBuffer = initArrayBufferForLaterUse(gl, new Float32Array(normals), 3, gl.FLOAT);
    if (!o.vertexBuffer || !o.colorBuffer || !o.normalBuffer)
        console.log("Error: in initVertexBufferForLaterUse(gl, vertices, colors)");
    o.numVertices = nVertices;

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return o;
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