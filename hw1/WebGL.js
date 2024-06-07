var VSHADER_SOURCE = `
        attribute vec4 a_Position;
        attribute vec4 a_Color;
        varying vec4 v_Color;
        void main(){
            gl_Position = a_Position;
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

var triangleVertices = [
    0.0, 0.0433,
    -0.05, -0.0433,
    0.05, -0.0433];
var squareVertices = [
    -0.05, 0.05,
    0.05, 0.05,
    -0.05, -0.05,
    0.05, -0.05
];
var diamondVertices = [
    -0.0707, 0,
    0, 0.0707,
    0, -0.0707,
    0.0707, 0
];
var choose = 0;
var who_T = 0;
var who_S = 0;
var who_D = 0;
var points_T = [[-10, -10], [-10, -10], [-10, -10]];
var points_S = [[-10, -10], [-10, -10], [-10, -10]];
var points_D = [[-10, -10], [-10, -10], [-10, -10]];
var colors_T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
var colors_S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
var colors_D = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
function main() {
    //////Get the canvas context
    var canvas = document.getElementById('webgl');
    var gl = canvas.getContext('webgl2');
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    /////compile shader and use it
    let program = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    gl.useProgram(program);

    /////prepare attribute reference of the shader
    program.a_Position = gl.getAttribLocation(program, 'a_Position');
    program.a_Color = gl.getAttribLocation(program, 'a_Color');
    if (program.a_Position < 0 || program.a_Color < 0)
        console.log('Error: f(program.a_Position<0 || program.a_Color<0 || .....');

    canvas.onmousedown = function (ev) { click(ev, gl, canvas, program.u_Position, program.u_FragColor, program) }

    document.addEventListener('keydown', (event) => {
        if (event.key == 'a' || event.key == 'A') { //move triangle1 to the left
            // console.log('A');
            choose = ((choose + 1) % 3);
            // draw(gl, program);
        } else if (event.key == 'r' || event.key == 'R') { //move triangle1 to the left
            // console.log('A');
            choose = 0;
            who = 0;
            points_T = [[-10, -10], [-10, -10], [-10, -10]];
            points_S = [[-10, -10], [-10, -10], [-10, -10]];
            points_D = [[-10, -10], [-10, -10], [-10, -10]];
            colors_T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
            colors_S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
            colors_D = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
            draw(gl, program);
        }
    });
    draw(gl, program);

}
function click(ev, gl, canvas, u_Position, u_FragColor, program) {
    var x = ev.clientX;
    var y = ev.clientY;
    var rect = ev.target.getBoundingClientRect();
    x = (x - rect.left) * 2 / rect.width - 1;
    y = 1 - ((y - rect.top) * 2 / rect.height);
    switch (choose) {
        case 0:
            points_T[who_T] = [x, y];
            colors_T[who_T] = [Math.random(), Math.random(), Math.random()];
            who_T = (who_T + 1) % 3;
            break;
        case 1:
            points_S[who_S] = [x, y];
            colors_S[who_S] = [Math.random(), Math.random(), Math.random()];
            who_S = (who_S + 1) % 3;
            break;
        case 2:
            points_D[who_D] = [x, y];
            colors_D[who_D] = [Math.random(), Math.random(), Math.random()];
            who_D = (who_D + 1) % 3;
            break;
    }


    draw(gl, program);

}
function initVertexBuffers(gl, program, x, shape) {
    var s;
    var arr = [];
    if (shape == 0) {
        s = triangleVertices;
        for (var i = 0; i < s.length; i += 2) {
            arr.push(points_T[x][0] + s[i]);
            arr.push(points_T[x][1] + s[i + 1]);
            for (var j = 0; j < 3; ++j) {
                arr.push(colors_T[x][j]);
            }
        }
    } else if (shape == 1) {
        s = squareVertices;
        for (var i = 0; i < s.length; i += 2) {
            arr.push(points_S[x][0] + s[i]);
            arr.push(points_S[x][1] + s[i + 1]);
            for (var j = 0; j < 3; ++j) {
                arr.push(colors_S[x][j]);
            }
        }
    } else {
        s = diamondVertices;
        for (var i = 0; i < s.length; i += 2) {
            arr.push(points_D[x][0] + s[i]);
            arr.push(points_D[x][1] + s[i + 1]);
            for (var j = 0; j < 3; ++j) {
                arr.push(colors_D[x][j]);
            }
        }
    }
    var vertices = new Float32Array(arr);
    // console.log(vertices);
    var n = vertices.length / 5;
    var vertexBuffer = gl.createBuffer();
    if (!vertexBuffer) {
        console.log('Failed to create the buffer object');
        return -1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    var FSIZE = vertices.BYTES_PER_ELEMENT;
    var a_Position = gl.getAttribLocation(program, 'a_Position');
    if (a_Position < 0) {
        console.log('Failed to get the storage location of attribute');
        return -1;
    }
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 5 * FSIZE, 0);
    gl.enableVertexAttribArray(a_Position);
    var a_Color = gl.getAttribLocation(program, 'a_Color');
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, 5 * FSIZE, 2 * FSIZE);
    gl.enableVertexAttribArray(a_Color);
    if (a_Color < 0) {
        console.log('Failed to get the storage color of attribute');
        return -1;
    }
    return n;
}
function draw(gl, program) {
    ////clear background color by black
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (var s = 0; s < 3; ++s) {
        var points;
        switch (s) {
            case 0:
                points = points_T;
                break;
            case 1:
                points = points_S;
                break;
            case 2:
                points = points_D;
                break;
        }
        for (var i = 0; i < 3; ++i) {
            if (points[i][0] != -10 && points[i][1] != -10) {
                var n = initVertexBuffers(gl, program, i, s);
                if (n != -1) {
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, n);
                }
            }
        }
    }
}
