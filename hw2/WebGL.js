var VSHADER_SOURCE = `
        attribute vec4 a_Position;
        attribute vec4 a_Color;
        varying vec4 v_Color;
        uniform mat4 u_modelMatrix;
        void main(){
            gl_Position = u_modelMatrix * a_Position;
            gl_PointSize = 10.0;
            v_Color = a_Color;
        }    
    `;

var FSHADER_SOURCE = `
        precision mediump float;
        varying vec4 v_Color;
        void main(){
            gl_FragColor = v_Color;
        }
    `;


function createProgram(gl, vertexShader, fragmentShader) {
    //create the program and attach the shaders
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    //if success, return the program. if not, log the program info, and delete it.
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return program;
    }
    alert(gl.getProgramInfoLog(program) + "");
    gl.deleteProgram(program);
}

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

/////BEGIN:///////////////////////////////////////////////////////////////////////////////////////////////
/////The folloing three function is for creating vertex buffer, but link to shader to user later//////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////
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

function initVertexBufferForLaterUse(gl, vertices, colors) {
    var nVertices = vertices.length / 3;

    var o = new Object();
    o.vertexBuffer = initArrayBufferForLaterUse(gl, new Float32Array(vertices), 3, gl.FLOAT);
    o.colorBuffer = initArrayBufferForLaterUse(gl, new Float32Array(colors), 3, gl.FLOAT);
    if (!o.vertexBuffer || !o.colorBuffer)
        console.log("Error: in initVertexBufferForLaterUse(gl, vertices, colors)");
    o.numVertices = nVertices;

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return o;
}
/////END://///////////////////////////////////////////////////////////////////////////////////////////////
/////The folloing three function is for creating vertex buffer, but link to shader to user later//////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////

var transformMat = new Matrix4(); //cuon 4x4 matrix
var transformMatCircle1 = new Matrix4(); //initial circle base transformation matrix

//NOTE: You are NOT allowed to change the vertex information here
var triangleVertices = [
    -0.1, 0, 0,
    0, Math.sqrt(3) / 10, 0,
    0.1, 0, 0];
var triangle2Vertices = [
    -0.1, 0, 0,
    0, -Math.sqrt(3) / 10, 0,
    0.1, 0, 0];
var triangle2colors = [
    1, 0, 0,
    1, 0, 0,
    1, 0, 0];
var baseColors = [];
var carVertices = [];
var objVertices = []
var carColors = []; //green trotating riangle color
var circleVertices = []
var eyeVertices = []
var circleColors = []
var eyeColors = []
var objColors = []
var objColorsTouch = []
var objColorsGrab = []
var wheelColors = []
var circleRadius = 0.05
var eyeRadius = 0.05
var objRadius = 0.1
var scale = 1
var handVertices = []
var handColors = []; //green trotating riangle color
function makeCircleVertice(rad, Vertices) {
    for (i = 0; i <= 1000; ++i) {
        x = rad * Math.cos(i * 2 * Math.PI / 200)
        y = rad * Math.sin(i * 2 * Math.PI / 200)
        Vertices.push(x, y);
        // Colors.push(1, 0, 1); //circle normal color
    }
}
function makeRectangleVertice(width, height, Vertices) {
    Vertices.push(
        -width / 2, height / 2, 0,
        -width / 2, -height / 2, 0,
        width / 2, height / 2, 0,
        width / 2, -height / 2, 0
    )
}
function colorMatrix(size, r, g, b, c) {
    for (i = 0; i < size; ++i) {
        c.push(r, g, b);
    }
}

//NOTE: You are NOT allowed to change the vertex information here
// var triangleVerticesA = [0.0, 0.2, 0.0, -0.1, -0.3, 0.0, 0.1, -0.3, 0.0]; 
// var triangleColorA = [0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0]; //green trotating riangle color
// var triangleVerticesB = [0.0, 0.0, 0.0, -0.1, -0.5, 0.0, 0.1, -0.5, 0.0]; 
// var triangleColorB = [0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0]; //green trotating riangle color

var carXMove = 0;
var carYMove = 0;
var triangle2HeightScale = 1;
var handAngle = 0;
var hand2Angle = 90;
var hand3Angle = 0;
var crawLocX = 0
var crawLocY = 0
var objX, obgY
var touched = 0
var grab = 0
function main() {
    //////Get the canvas context
    objX = Math.random() * 2 - 1
    objY = Math.random() * 2 - 1
    circleRadius = 0.05;
    makeRectangleVertice(0.4, 0.6, carVertices);
    makeRectangleVertice(0.1, 0.2, handVertices);
    makeCircleVertice(circleRadius, circleVertices);
    makeCircleVertice(eyeRadius, eyeVertices)
    makeCircleVertice(eyeRadius / 2, eyeVertices)
    makeCircleVertice(objRadius, objVertices)
    colorMatrix(1001, 1, 0, 1, circleColors);
    colorMatrix(1001, 1, 0, 0, wheelColors);
    colorMatrix(1001, 1, 1, 1, eyeColors);
    colorMatrix(1001, 0, 0, 0, eyeColors);
    r = Math.random() * 0.3 + 0.4
    g = Math.random() * 0.3 + 0.4
    b = Math.random() * 0.3 + 0.4
    // console.log(r, g, b)
    colorMatrix(1001, r, g, b, objColors);
    colorMatrix(1001, 1 - r, 1 - g, 1 - b, objColorsTouch);
    colorMatrix(1001, r + 0.3, g + 0.3, b + 0.3, objColorsGrab);
    colorMatrix(4, 1, 1, 1, handColors);
    colorMatrix(4, 1, 1, 0, baseColors);
    colorMatrix(4, 0, 1, 0, carColors);
    var canvas = document.getElementById('webgl');
    var gl = canvas.getContext('webgl2');
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    /////compile shader and use it
    program = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    gl.useProgram(program);

    /////prepare attribute reference of the shader
    program.a_Position = gl.getAttribLocation(program, 'a_Position');
    program.a_Color = gl.getAttribLocation(program, 'a_Color');
    program.u_modelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');
    if (program.a_Position < 0 || program.a_Color < 0 || program.u_modelMatrix < 0)
        console.log('Error: f(program.a_Position<0 || program.a_Color<0 || .....');

    /////create vertex buffer of rotating point, center points, rotating triangle for later use
    carModel = initVertexBufferForLaterUse(gl, carVertices, carColors);
    wheelModel = init89VertexBufferForLaterUse(gl, circleVertices, wheelColors);
    baseModel = initVertexBufferForLaterUse(gl, triangleVertices, baseColors);
    arthModel = initVertexBufferForLaterUse(gl, circleVertices, circleColors);
    handModel = initVertexBufferForLaterUse(gl, handVertices, handColors);
    crawModel = initVertexBufferForLaterUse(gl, triangle2Vertices, triangle2colors);
    eyeModel = initVertexBufferForLaterUse(gl, eyeVertices, eyeColors);
    // objModel = initVertexBufferForLaterUse(gl, objVertices,);
    // triangleModelB = initVertexBufferForLaterUse(gl, triangleVerticesB, triangleColorB);

    document.addEventListener('keydown', (event) => {
        if (event.key == 'a' || event.key == 'A') { //move car to the left
            console.log('A')
            carXMove -= 0.05;
            draw(gl)
        } else if (event.key == 'd' || event.key == 'D') {  //move car to the right
            console.log('D')
            carXMove += 0.05;
            draw(gl)
        } else if (event.key == 's' || event.key == 'S') {  //move car to the down
            console.log('S')
            carYMove -= 0.05;
            draw(gl)
        } else if (event.key == 'w' || event.key == 'W') {  //move car to the right
            console.log('W')
            carYMove += 0.05;
            draw(gl)
        } else if (event.key == 'r' || event.key == 'R') {  //rotate the first hand
            console.log('r')
            handAngle += 10;
            draw(gl)
        } else if ((event.key == 't' || event.key == 'T')) { //rotate the second hand
            console.log('T')
            hand2Angle += 10;
            draw(gl)
        } else if ((event.key == 'y' || event.key == 'Y')) { //rotate the third hand
            console.log('Y')
            hand3Angle += 10;
            draw(gl)
        } else if (event.key == '[') {
            console.log('[')
            if (scale < 3) {
                scale += 0.1
                draw(gl)
            }
        } else if (event.key == ']') {
            console.log(']')
            if (scale > 0.2) {
                scale -= 0.1
                draw(gl)
            }
        } else if (event.key == 'g' || event.key == 'G') {
            console.log('G')
            if (touched) {
                grab = !grab
                objX = crawLocX
                objY = crawLocY
                draw(gl)
            }
        }
    });
    var tick = function () {
        draw(gl);
        requestAnimationFrame(tick);
    }
    tick();
}

function drawModel(gl, model, tm) {
    initAttributeVariable(gl, program.a_Position, model.vertexBuffer);//set triangle  vertex to shader varibale
    initAttributeVariable(gl, program.a_Color, model.colorBuffer); //set triangle  color to shader varibale
    gl.uniformMatrix4fv(program.u_modelMatrix, false, tm.elements);//pass current transformMat to shader4
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, model.numVertices);
}
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2))
}
function draw(gl) {

    ////clear background color by black
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    transformMat.setIdentity(); //set identity matrix to transformMat
    transformMat.scale(scale, scale, 1)
    transformMat.translate(carXMove, carYMove, 0);
    drawModel(gl, carModel, transformMat);
    transformMat.translate(-0.1, 0, 0);
    drawModel(gl, eyeModel, transformMat);
    transformMat.translate(0.2, 0, 0);
    drawModel(gl, eyeModel, transformMat);
    transformMat.translate(-0.2, -0.3, 0);
    drawModel(gl, wheelModel, transformMat);
    transformMat.translate(0, -0.17, 0);
    transformMat.scale(1, 1.5, 1);
    drawModel(gl, handModel, transformMat);
    transformMat.scale(1, 1 / 1.5, 1);

    transformMat.translate(0, 0.17, 0);
    transformMat.translate(0.2, 0, 0);
    drawModel(gl, wheelModel, transformMat);
    transformMat.translate(0, -0.17, 0);
    transformMat.scale(1, 1.5, 1);
    drawModel(gl, handModel, transformMat);
    transformMat.scale(1, 1 / 1.5, 1);
    transformMat.translate(0, 0.17, 0);

    transformMat.translate(-0.2, 0.3, 0);
    transformMat.translate(- Math.sqrt(3) / 20, 0, 0);
    transformMat.rotate(90, 0, 0, 1);
    drawModel(gl, baseModel, transformMat);

    transformMat.translate(0, 0.173, 0);
    transformMat.rotate(handAngle, 0, 0, 1);
    drawModel(gl, arthModel, transformMat);

    transformMat.translate(0, 0.15, 0);
    drawModel(gl, handModel, transformMat);

    transformMat.translate(0, 0.15, 0);
    transformMat.rotate(hand2Angle, 0, 0, 1);
    drawModel(gl, arthModel, transformMat);


    transformMat.translate(0, 0.15, 0);
    drawModel(gl, handModel, transformMat);


    transformMat.translate(0, 0.15, 0);
    transformMat.rotate(hand3Angle, 0, 0, 1);
    drawModel(gl, arthModel, transformMat);

    transformMat.translate(0, Math.sqrt(3) / 10 + 0.05, 0);
    drawModel(gl, crawModel, transformMat);
    loc = transformMat.multiplyVector4(new Vector4([-0.1, 0, 0, 1]))
    // console.log(transformMat.elements)
    // console.log(loc.elements)
    crawLocX = loc.elements[0]
    crawLocY = loc.elements[1]

    transformMatCircle1.setIdentity()
    transformMatCircle1.translate(objX, objY, 0);
    transformMatCircle1.scale(scale, scale, 1)
    // transformMatCircle1.scale(1 / scale, 1 / scale, 1)
    loc = transformMatCircle1.multiplyVector4(new Vector4([0, 0, 0, 1]))
    circleX = loc.elements[0]
    circleY = loc.elements[1]
    dis = distance(crawLocX, crawLocY, circleX, circleY)
    // console.log(dis)
    // console.log(scale)
    if (dis < (0.11 * scale)) {
        touched = 1
    } else {
        touched = 0
    }
    if (grab) {
        objX = crawLocX
        objY = crawLocY

        console.log('grab')
        objModel = initVertexBufferForLaterUse(gl, objVertices, objColorsGrab);
    } else if (touched) {
        console.log('touch')
        objModel = initVertexBufferForLaterUse(gl, objVertices, objColorsTouch);
    } else {
        console.log('normal')
        objModel = initVertexBufferForLaterUse(gl, objVertices, objColors);
    }
    drawModel(gl, objModel, transformMatCircle1)
    // if(grab)
}
