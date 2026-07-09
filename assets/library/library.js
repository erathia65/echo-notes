// echo-library — Step 2: point light + lamp sphere.
// Cube lit by a single point light at (0, 2.5, 1.5) with inverse-square
// falloff. The lamp itself is a small warm sphere, fully bright.
//
// Shaders inlined. No async. No merged arrays.

(function () {
  'use strict';

  try {
    console.log('[library] script loaded');

    const canvas = document.querySelector('.library-3d');
    if (!canvas) { console.warn('[library] no .library-3d canvas found'); return; }
    console.log('[library] canvas found', canvas);

    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:block;z-index:-1;pointer-events:none;background:#0e0e0e';

    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) {
      console.warn('[library] WebGL 2 unavailable; static dark fallback.');
      return;
    }
    console.log('[library] WebGL 2 context OK');

    // ---- Cube vertex shader: pass world position + world normal ----
    const cubeVsSrc = `#version 300 es
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

    // ---- Cube fragment shader: ambient + 1 point light ----
    const cubeFsSrc = `#version 300 es
      precision highp float;
      in vec3 v_worldNormal;
      in vec3 v_worldPos;
      uniform vec3 u_lampPos;
      uniform vec3 u_lampColor;
      uniform float u_lampIntensity;
      uniform float u_ambient;
      uniform vec3 u_baseColor;
      out vec4 outColor;
      void main() {
        vec3 N = normalize(v_worldNormal);
        vec3 toLamp = u_lampPos - v_worldPos;
        float dist = length(toLamp);
        vec3 L = toLamp / max(dist, 0.0001);
        float ndl = max(dot(N, L), 0.0);
        float atten = 1.0 / (1.0 + dist * dist * 0.5);
        vec3 lighting = vec3(u_ambient) + u_lampColor * u_lampIntensity * ndl * atten;
        outColor = vec4(u_baseColor * lighting, 1.0);
      }
    `;

    // ---- Lamp vertex shader (identity transform, but u_model places it) ----
    const lampVsSrc = cubeVsSrc;
    // ---- Lamp fragment shader: fully bright, no falloff ----
    const lampFsSrc = `#version 300 es
      precision highp float;
      in vec3 v_worldNormal;
      in vec3 v_worldPos;
      uniform vec3 u_lampColor;
      uniform float u_lampIntensity;
      out vec4 outColor;
      void main() {
        outColor = vec4(u_lampColor * u_lampIntensity * 1.5, 1.0);
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
    function linkProgram(vs, fs) {
      const p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error('[library] link error:', gl.getProgramInfoLog(p));
        return null;
      }
      return p;
    }
    const cubeVs = compile(gl.VERTEX_SHADER, cubeVsSrc);
    const cubeFs = compile(gl.FRAGMENT_SHADER, cubeFsSrc);
    const lampVs = compile(gl.VERTEX_SHADER, lampVsSrc);
    const lampFs = compile(gl.FRAGMENT_SHADER, lampFsSrc);
    if (!cubeVs || !cubeFs || !lampVs || !lampFs) return;
    const cubeProgram = linkProgram(cubeVs, cubeFs);
    const lampProgram = linkProgram(lampVs, lampFs);
    if (!cubeProgram || !lampProgram) return;
    console.log('[library] both programs linked');

    // ---- Cube geometry: 24 vertices (4 per face), 36 indices ----
    const cubeVerts = new Float32Array([
      0.5,-0.5,-0.5,  1,0,0,   0.5, 0.5,-0.5,  1,0,0,   0.5, 0.5, 0.5,  1,0,0,   0.5,-0.5, 0.5,  1,0,0,
     -0.5,-0.5, 0.5, -1,0,0,  -0.5, 0.5, 0.5, -1,0,0,  -0.5, 0.5,-0.5, -1,0,0,  -0.5,-0.5,-0.5, -1,0,0,
     -0.5, 0.5,-0.5,  0,1,0,  -0.5, 0.5, 0.5,  0,1,0,   0.5, 0.5, 0.5,  0,1,0,   0.5, 0.5,-0.5,  0,1,0,
     -0.5,-0.5, 0.5,  0,-1,0, -0.5,-0.5,-0.5,  0,-1,0,  0.5,-0.5,-0.5,  0,-1,0,  0.5,-0.5, 0.5,  0,-1,0,
     -0.5,-0.5, 0.5,  0,0,1,   0.5,-0.5, 0.5,  0,0,1,   0.5, 0.5, 0.5,  0,0,1,  -0.5, 0.5, 0.5,  0,0,1,
      0.5,-0.5,-0.5,  0,0,-1, -0.5,-0.5,-0.5,  0,0,-1, -0.5, 0.5,-0.5,  0,0,-1,  0.5, 0.5,-0.5,  0,0,-1,
    ]);
    const cubeIdx = new Uint16Array([
      0,1,2, 0,2,3,
      4,5,6, 4,6,7,
      8,9,10, 8,10,11,
      12,13,14, 12,14,15,
      16,17,18, 16,18,19,
      20,21,22, 20,22,23,
    ]);

    // ---- Sphere geometry: UV sphere, 16 segments x 12 rings ----
    function makeSphere(radius, segments, rings) {
      const verts = [];
      const idx = [];
      for (let r = 0; r <= rings; r++) {
        const v = r / rings;
        const phi = v * Math.PI;
        for (let s = 0; s <= segments; s++) {
          const u = s / segments;
          const theta = u * 2 * Math.PI;
          const x = Math.sin(phi) * Math.cos(theta);
          const y = Math.cos(phi);
          const z = Math.sin(phi) * Math.sin(theta);
          verts.push(x*radius, y*radius, z*radius,  x, y, z);
        }
      }
      const stride = segments + 1;
      for (let r = 0; r < rings; r++) {
        for (let s = 0; s < segments; s++) {
          const a = r*stride + s;
          const b = a + stride;
          idx.push(a, b, a+1,  b, b+1, a+1);
        }
      }
      return { vertices: new Float32Array(verts), indices: new Uint16Array(idx) };
    }
    const sphere = makeSphere(0.10, 16, 12);  // 0.10m radius lamp
    console.log('[library] sphere: verts=', sphere.vertices.length/6, 'tris=', sphere.indices.length/3);

    // ---- Cube VAO ----
    const cubeVao = gl.createVertexArray();
    gl.bindVertexArray(cubeVao);
    const cubeVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVbo);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVerts, gl.STATIC_DRAW);
    const cubeIbo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIdx, gl.STATIC_DRAW);
    const cubeAPos = gl.getAttribLocation(cubeProgram, 'a_position');
    const cubeANormal = gl.getAttribLocation(cubeProgram, 'a_normal');
    gl.enableVertexAttribArray(cubeAPos);
    gl.vertexAttribPointer(cubeAPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(cubeANormal);
    gl.vertexAttribPointer(cubeANormal, 3, gl.FLOAT, false, 24, 12);

    // ---- Lamp VAO ----
    const lampVao = gl.createVertexArray();
    gl.bindVertexArray(lampVao);
    const lampVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lampVbo);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.vertices, gl.STATIC_DRAW);
    const lampIbo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lampIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
    const lampAPos = gl.getAttribLocation(lampProgram, 'a_position');
    const lampANormal = gl.getAttribLocation(lampProgram, 'a_normal');
    gl.enableVertexAttribArray(lampAPos);
    gl.vertexAttribPointer(lampAPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(lampANormal);
    gl.vertexAttribPointer(lampANormal, 3, gl.FLOAT, false, 24, 12);

    // ---- Uniform locations ----
    const uCubeProjection = gl.getUniformLocation(cubeProgram, 'u_projection');
    const uCubeView = gl.getUniformLocation(cubeProgram, 'u_view');
    const uCubeModel = gl.getUniformLocation(cubeProgram, 'u_model');
    const uCubeLampPos = gl.getUniformLocation(cubeProgram, 'u_lampPos');
    const uCubeLampColor = gl.getUniformLocation(cubeProgram, 'u_lampColor');
    const uCubeLampIntensity = gl.getUniformLocation(cubeProgram, 'u_lampIntensity');
    const uCubeAmbient = gl.getUniformLocation(cubeProgram, 'u_ambient');
    const uCubeBaseColor = gl.getUniformLocation(cubeProgram, 'u_baseColor');

    const uLampProjection = gl.getUniformLocation(lampProgram, 'u_projection');
    const uLampView = gl.getUniformLocation(lampProgram, 'u_view');
    const uLampModel = gl.getUniformLocation(lampProgram, 'u_model');
    const uLampLampColor = gl.getUniformLocation(lampProgram, 'u_lampColor');
    const uLampLampIntensity = gl.getUniformLocation(lampProgram, 'u_lampIntensity');

    console.log('[library] cube uniforms OK:', !!uCubeProjection, !!uCubeView, !!uCubeModel, !!uCubeLampPos, !!uCubeLampColor, !!uCubeLampIntensity, !!uCubeAmbient, !!uCubeBaseColor);
    console.log('[library] lamp uniforms OK:', !!uLampProjection, !!uLampView, !!uLampModel, !!uLampLampColor, !!uLampLampIntensity);

    // ---- Matrix math ----
    function mat4Identity() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
    function mat4Multiply(a, b) {
      const out = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        out[i*4+j] = a[i*4]*b[j] + a[i*4+1]*b[4+j] + a[i*4+2]*b[8+j] + a[i*4+3]*b[12+j];
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
    function mat4Translation(x, y, z) {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
    }
    function mat4RotationY(angle) {
      const c = Math.cos(angle), s = Math.sin(angle);
      return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
    }

    // ---- Resize ----
    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    window.addEventListener('resize', resize);
    resize();

    // ---- Camera & lighting ----
    const eye = [0, 1, 3];
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const projection = mat4Perspective((60 * Math.PI) / 180, canvas.width / canvas.height, 0.1, 100);
    const view = mat4LookAt(eye, target, up);
    const LAMP_POS = [0, 2.5, 1.5];
    const LAMP_COLOR = [0.957, 0.847, 0.537];  // #f4d889
    const cubeColor = [0.6, 0.45, 0.30];  // warm brown
    const cubeBase = mat4Translation(0, 0, 0);  // cube at origin
    const lampBase = mat4Translation(LAMP_POS[0], LAMP_POS[1], LAMP_POS[2]);

    console.log('[library] scene: cube at origin, lamp at', LAMP_POS, 'camera at', eye);

    const start = performance.now();
    function loop() {
      const t = (performance.now() - start) / 1000;
      // Cube rotates around Y, slowly
      const cubeModel = mat4Multiply(mat4RotationY(t * (2 * Math.PI / 10)), cubeBase);
      // Lamp doesn't rotate; static
      const lampModel = lampBase;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0.055, 0.055, 0.055, 1.0);  // dark bg
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // ---- Draw the cube (lit by the lamp) ----
      gl.useProgram(cubeProgram);
      gl.uniformMatrix4fv(uCubeProjection, false, projection);
      gl.uniformMatrix4fv(uCubeView, false, view);
      gl.uniformMatrix4fv(uCubeModel, false, cubeModel);
      gl.uniform3fv(uCubeLampPos, LAMP_POS);
      gl.uniform3fv(uCubeLampColor, LAMP_COLOR);
      gl.uniform1f(uCubeLampIntensity, 1.0);
      gl.uniform1f(uCubeAmbient, 0.05);
      gl.uniform3fv(uCubeBaseColor, cubeColor);
      gl.bindVertexArray(cubeVao);
      gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

      // ---- Draw the lamp sphere (fully bright) ----
      gl.useProgram(lampProgram);
      gl.uniformMatrix4fv(uLampProjection, false, projection);
      gl.uniformMatrix4fv(uLampView, false, view);
      gl.uniformMatrix4fv(uLampModel, false, lampModel);
      gl.uniform3fv(uLampLampColor, LAMP_COLOR);
      gl.uniform1f(uLampLampIntensity, 1.0);
      gl.bindVertexArray(lampVao);
      gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);

      requestAnimationFrame(loop);
    }
    loop();
    console.log('[library] render loop started');
  } catch (err) {
    console.error('[library] caught error:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
  }
})();
