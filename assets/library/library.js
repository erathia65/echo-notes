// MINIMAL WebGL 2 test: one fullscreen quad, one shader, animated color.
// Bypasses all geometry, all lighting, all camera math. If this renders
// animated color, WebGL works. If still black, the canvas isn't drawing.

(function () {
  'use strict';
  try {
    console.log('[minimal] script loaded');

    const canvas = document.querySelector('.library-3d');
    if (!canvas) { console.warn('[minimal] no canvas'); return; }
    console.log('[minimal] canvas found');

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:block;z-index:-1';
    console.log('[minimal] canvas size:', canvas.width, 'x', canvas.height);

    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) { console.warn('[minimal] no WebGL 2'); return; }
    console.log('[minimal] WebGL 2 OK');

    // Vertex shader: pass through a normalized device coordinate.
    // The quad is drawn as a triangle strip with positions in [-1, 1].
    const vsSrc = `#version 300 es
      in vec2 a_pos;
      out vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;  // [-1,1] -> [0,1]
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;
    // Fragment shader: a UV-based animated gradient.
    const fsSrc = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      uniform float u_time;
      out vec4 outColor;
      void main() {
        // Three-color gradient that pulses with time.
        vec3 c1 = vec3(0.957, 0.847, 0.537);  // #f4d889 (lamp)
        vec3 c2 = vec3(0.18, 0.10, 0.10);    // dark red
        vec3 c3 = vec3(0.05, 0.05, 0.10);    // near-black
        float t = u_time;
        float pulse = 0.5 + 0.5 * sin(t * 0.5);
        vec3 col = mix(c3, c1, v_uv.y);
        col = mix(col, c2, v_uv.x * pulse);
        outColor = vec4(col, 1.0);
      }
    `;

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[minimal] shader compile:', gl.getShaderInfoLog(sh));
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
      console.error('[minimal] link error:', gl.getProgramInfoLog(program));
      return;
    }
    console.log('[minimal] program linked');

    // Fullscreen quad as a triangle strip
    const verts = new Float32Array([
      -1, -1,   1, -1,   -1, 1,   1, 1
    ]);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const uTime = gl.getUniformLocation(program, 'u_time');

    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const start = performance.now();
    function loop() {
      const t = (performance.now() - start) / 1000;
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(loop);
    }
    loop();
    console.log('[minimal] render loop started');
  } catch (err) {
    console.error('[minimal] caught:', err && err.message ? err.message : err);
  }
})();
