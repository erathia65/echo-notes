// echo-library — baseline WebGL 2 scene.
// Single rotating cube, Phong lighting, perspective camera.
// No async, no separate shader files, no merged arrays. One cube.
//
// Loaded only on post pages. Graceful fallback: if WebGL 2 is
// unavailable, the canvas stays empty and the post page reads on
// its own.

(function () {
  'use strict';

  try {
    console.log('[library] script loaded');

    const canvas = document.querySelector('.library-3d');
    if (!canvas) { console.warn('[library] no .library-3d canvas found'); return; }
    console.log('[library] canvas found', canvas);

    // Make sure the canvas is fixed full-viewport, behind everything.
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:block;z-index:-1;pointer-events:none;background:#1a1a1a';

    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) {
      console.warn('[library] WebGL 2 unavailable; static dark fallback.');
      return;
    }
    console.log('[library] WebGL 2 context OK');

    // ---- Vertex shader: position + normal -> world space, pass to frag ----
    const vsSrc = `#version 300 es
      in vec3 a_position;
      in vec3 a_normal;
      uniform mat4 u_projection;
      uniform mat4 u_view;
      uniform mat4 u_model;
      out vec3 v_worldNormal;
      out vec3 v_worldPos;
      void main() {
        vec4 worldPos = u_model * vec4(a_position, 1.0);
        v_worldPos = worldPos.xyz;
        v_worldNormal = normalize(mat3(u_model) * a_normal);
        gl_Position = u_projection * u_view * worldPos;
      }
    `;

    // ---- Fragment shader: Phong (ambient + diffuse + specular) ----
    const fsSrc = `#version 300 es
      precision highp float;
      in vec3 v_worldNormal;
      in vec3 v_worldPos;
      uniform vec3 u_lightDir;       // direction TO the light
      uniform vec3 u_cameraPos;
      uniform vec3 u_baseColor;
      out vec4 outColor;
      void main() {
        vec3 N = normalize(v_worldNormal);
        vec3 L = normalize(u_lightDir);
        vec3 V = normalize(u_cameraPos - v_worldPos);
        vec3 R = reflect(-L, N);

        float ambient = 0.15;
        float diffuse = max(dot(N, L), 0.0);
        float specular = pow(max(dot(R, V), 0.0), 32.0) * 0.5;

        vec3 color = u_baseColor * (ambient + diffuse) + vec3(1.0) * specular;
        outColor = vec4(color, 1.0);
      }
    `;

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[library] shader compile error:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[library] link error:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    console.log('[library] program linked');

    // ---- Cube geometry: 24 vertices (4 per face), 36 indices ----
    // 6 floats per vertex: x, y, z, nx, ny, nz
    const cubeVertices = new Float32Array([
      // +X face (normal +X)
      0.5,-0.5,-0.5,  1,0,0,
      0.5, 0.5,-0.5,  1,0,0,
      0.5, 0.5, 0.5,  1,0,0,
      0.5,-0.5, 0.5,  1,0,0,
      // -X face
     -0.5,-0.5, 0.5, -1,0,0,
     -0.5, 0.5, 0.5, -1,0,0,
     -0.5, 0.5,-0.5, -1,0,0,
     -0.5,-0.5,-0.5, -1,0,0,
      // +Y face
     -0.5, 0.5,-0.5,  0,1,0,
     -0.5, 0.5, 0.5,  0,1,0,
      0.5, 0.5, 0.5,  0,1,0,
      0.5, 0.5,-0.5,  0,1,0,
      // -Y face
     -0.5,-0.5, 0.5,  0,-1,0,
     -0.5,-0.5,-0.5,  0,-1,0,
      0.5,-0.5,-0.5,  0,-1,0,
      0.5,-0.5, 0.5,  0,-1,0,
      // +Z face
     -0.5,-0.5, 0.5,  0,0,1,
      0.5,-0.5, 0.5,  0,0,1,
      0.5, 0.5, 0.5,  0,0,1,
     -0.5, 0.5, 0.5,  0,0,1,
      // -Z face
      0.5,-0.5,-0.5,  0,0,-1,
     -0.5,-0.5,-0.5,  0,0,-1,
     -0.5, 0.5,-0.5,  0,0,-1,
      0.5, 0.5,-0.5,  0,0,-1,
    ]);
    const cubeIndices = new Uint16Array([
      0,1,2, 0,2,3,        // +X
      4,5,6, 4,6,7,        // -X
      8,9,10, 8,10,11,     // +Y
      12,13,14, 12,14,15,  // -Y
      16,17,18, 16,18,19,  // +Z
      20,21,22, 20,22,23,  // -Z
    ]);
    console.log('[library] cube: 24 verts, 36 indices, 12 triangles');

    // ---- VAO + buffers ----
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'a_position');
    const aNormal = gl.getAttribLocation(program, 'a_normal');
    console.log('[library] aPos=', aPos, 'aNormal=', aNormal);

    // 6 floats per vertex, stride 24 bytes
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 24, 12);

    // ---- Uniform locations ----
    const uProjection = gl.getUniformLocation(program, 'u_projection');
    const uView = gl.getUniformLocation(program, 'u_view');
    const uModel = gl.getUniformLocation(program, 'u_model');
    const uLightDir = gl.getUniformLocation(program, 'u_lightDir');
    const uCameraPos = gl.getUniformLocation(program, 'u_cameraPos');
    const uBaseColor = gl.getUniformLocation(program, 'u_baseColor');
    console.log('[library] uniforms:',
      'uProjection=', !!uProjection,
      'uView=', !!uView,
      'uModel=', !!uModel,
      'uLightDir=', !!uLightDir,
      'uCameraPos=', !!uCameraPos,
      'uBaseColor=', !!uBaseColor);

    // ---- Matrix math (just enough) ----
    function mat4Identity() {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    }
    function mat4Multiply(a, b) {
      const out = new Float32Array(16);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          out[i*4+j] =
            a[i*4+0]*b[0*4+j] +
            a[i*4+1]*b[1*4+j] +
            a[i*4+2]*b[2*4+j] +
            a[i*4+3]*b[3*4+j];
        }
      }
      return out;
    }
    function mat4Perspective(fovY, aspect, near, far) {
      const f = 1.0 / Math.tan(fovY / 2);
      const nf = 1.0 / (near - far);
      return new Float32Array([
        f/aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far+near)*nf, -1,
        0, 0, 2*far*near*nf, 0,
      ]);
    }
    function mat4LookAt(eye, target, up) {
      let fx = target[0]-eye[0], fy = target[1]-eye[1], fz = target[2]-eye[2];
      const fl = Math.hypot(fx, fy, fz);
      fx/=fl; fy/=fl; fz/=fl;
      let rx = fy*up[2]-fz*up[1], ry = fz*up[0]-fx*up[2], rz = fx*up[1]-fy*up[0];
      const rl = Math.hypot(rx, ry, rz);
      rx/=rl; ry/=rl; rz/=rl;
      const ux = ry*fz-rz*fy, uy = rz*fx-rx*fz, uz = rx*fy-ry*fx;
      return new Float32Array([
        rx, ux, -fx, 0,
        ry, uy, -fy, 0,
        rz, uz, -fz, 0,
        -(rx*eye[0]+ry*eye[1]+rz*eye[2]),
        -(ux*eye[0]+uy*eye[1]+uz*eye[2]),
         (fx*eye[0]+fy*eye[1]+fz*eye[2]),
         1,
      ]);
    }
    function mat4RotationY(angle) {
      const c = Math.cos(angle), s = Math.sin(angle);
      return new Float32Array([
        c, 0,-s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1,
      ]);
    }

    // ---- Resize handler ----
    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        console.log('[library] canvas resized to', w, 'x', h);
      }
    }
    window.addEventListener('resize', resize);
    resize();

    // ---- Render loop ----
    const eye = [0, 1, 3];
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const projection = mat4Perspective((45 * Math.PI) / 180, canvas.width / canvas.height, 0.1, 100);
    const view = mat4LookAt(eye, target, up);
    const lightDir = [0.5, 0.7, 0.5];  // direction TO the light
    const baseColor = [0.85, 0.55, 0.25];  // warm orange

    console.log('[library] first frame: cube=24v, color=orange, light=above-right');

    const start = performance.now();
    function loop() {
      const t = (performance.now() - start) / 1000;
      const model = mat4RotationY(t * (2 * Math.PI / 10));  // 1 turn / 10s

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0.10, 0.10, 0.10, 1.0);  // dark gray background
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.uniformMatrix4fv(uProjection, false, projection);
      gl.uniformMatrix4fv(uView, false, view);
      gl.uniformMatrix4fv(uModel, false, model);
      gl.uniform3fv(uLightDir, lightDir);
      gl.uniform3fv(uCameraPos, eye);
      gl.uniform3fv(uBaseColor, baseColor);

      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

      requestAnimationFrame(loop);
    }
    loop();
    console.log('[library] render loop started');
  } catch (err) {
    console.error('[library] caught error:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
  }
})();
