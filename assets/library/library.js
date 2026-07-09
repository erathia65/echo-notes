// echo-library — procedural 3D library, Round 1 of v3.
// Geometry + camera + lamp. No sonar, no pulse, no time-of-flight.
//
// One WebGL 2.0 canvas, one mesh (a merged Float32Array of
// positions+normals), one index buffer, one draw call per frame.
// The fragment shader does traditional lighting: ambient + one
// point light (the lamp) + a per-vertex material color.
//
// Loaded only on post pages (the home and legacy pages are JS-free).
// Graceful fallback: if WebGL 2 is unavailable, the canvas stays
// empty and the dark post page reads on its own.

(function () {
  'use strict';

  try {
  console.log('[library] script loaded');

  const canvas = document.querySelector('.library-3d');
  if (!canvas) { console.warn('[library] no .library-3d canvas found'); return; }
  console.log('[library] canvas found', canvas);

  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) {
    console.warn('[library] WebGL 2 unavailable; static dark fallback.');
    return;
  }
  console.log('[library] WebGL 2 context OK');

  // ---------- Geometry helpers ----------

  // Build a unit cube (1x1x1) centered at origin. Caller places it
  // via u_model. Each face has its own 4 vertices so normals are correct.
  // The 7th float per vertex is the material id (0=floor, 1=wall, 2=shelf,
  // 3=book-dark, 4=book-accent, 5=desk, 6=lamp).
  function makeCube(materialId) {
    const faces = [
      { n: [ 1, 0, 0], v: [[ 0.5,-0.5,-0.5],[ 0.5, 0.5,-0.5],[ 0.5, 0.5, 0.5],[ 0.5,-0.5, 0.5]] },
      { n: [-1, 0, 0], v: [[-0.5,-0.5, 0.5],[-0.5, 0.5, 0.5],[-0.5, 0.5,-0.5],[-0.5,-0.5,-0.5]] },
      { n: [ 0, 1, 0], v: [[-0.5, 0.5,-0.5],[-0.5, 0.5, 0.5],[ 0.5, 0.5, 0.5],[ 0.5, 0.5,-0.5]] },
      { n: [ 0,-1, 0], v: [[-0.5,-0.5, 0.5],[-0.5,-0.5,-0.5],[ 0.5,-0.5,-0.5],[ 0.5,-0.5, 0.5]] },
      { n: [ 0, 0, 1], v: [[-0.5,-0.5, 0.5],[ 0.5,-0.5, 0.5],[ 0.5, 0.5, 0.5],[-0.5, 0.5, 0.5]] },
      { n: [ 0, 0,-1], v: [[ 0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5, 0.5,-0.5],[ 0.5, 0.5,-0.5]] },
    ];
    const verts = [];
    const indices = [];
    for (let f = 0; f < faces.length; f++) {
      const face = faces[f];
      const base = f * 4;
      for (let i = 0; i < 4; i++) {
        // 7 floats per vertex: x, y, z, nx, ny, nz, materialId
        verts.push(face.v[i][0], face.v[i][1], face.v[i][2],
                   face.n[0], face.n[1], face.n[2],
                   materialId);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return { vertices: new Float32Array(verts), indices: new Uint16Array(indices) };
  }

  // Build a UV sphere of given radius centered at origin.
  function makeSphere(radius, segments, rings, materialId) {
    const verts = [];
    const indices = [];
    for (let r = 0; r <= rings; r++) {
      const v = r / rings;
      const phi = v * Math.PI;
      for (let s = 0; s <= segments; s++) {
        const u = s / segments;
        const theta = u * 2 * Math.PI;
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);
        verts.push(x * radius, y * radius, z * radius,
                   x, y, z, materialId);
      }
    }
    const stride = segments + 1;
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segments; s++) {
        const a = r * stride + s;
        const b = a + stride;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { vertices: new Float32Array(verts), indices: new Uint16Array(indices) };
  }

  function mergeMeshes(meshes) {
    let totalVerts = 0, totalIndices = 0;
    for (const m of meshes) {
      totalVerts += m.vertices.length;
      totalIndices += m.indices.length;
    }
    const outV = new Float32Array(totalVerts);
    const outI = new Uint16Array(totalIndices);
    let vOff = 0, iOff = 0, vCount = 0;
    for (const m of meshes) {
      outV.set(m.vertices, vOff);
      for (let i = 0; i < m.indices.length; i++) {
        outI[iOff + i] = m.indices[i] + vCount;
      }
      vOff += m.vertices.length;
      iOff += m.indices.length;
      vCount += m.vertices.length / 7;
    }
    return { vertices: outV, indices: outI };
  }

  function placeCube(cx, cy, cz, sx, sy, sz, materialId) {
    const base = makeCube(materialId);
    const v = base.vertices;
    for (let i = 0; i < v.length; i += 7) {
      v[i + 0] = v[i + 0] * sx + cx;
      v[i + 1] = v[i + 1] * sy + cy;
      v[i + 2] = v[i + 2] * sz + cz;
    }
    return base;
  }

  // Material ids (must match the fragment shader)
  const MAT_FLOOR = 0;
  const MAT_WALL = 1;
  const MAT_SHELF = 2;
  const MAT_BOOK_DARK = 3;
  const MAT_BOOK_ACCENT = 4;
  const MAT_DESK = 5;
  const MAT_LAMP = 6;

  // ---------- Scene construction ----------

  const ROOM_W = 12, ROOM_D = 8, ROOM_H = 4;
  const HALF_W = ROOM_W / 2, HALF_D = ROOM_D / 2;

  const meshes = [];

  // Floor
  meshes.push(placeCube(0, -0.05, 0, ROOM_W, 0.1, ROOM_D, MAT_FLOOR));
  // Ceiling
  meshes.push(placeCube(0, ROOM_H + 0.05, 0, ROOM_W, 0.1, ROOM_D, MAT_FLOOR));
  // Walls
  meshes.push(placeCube(-HALF_W - 0.05, ROOM_H/2, 0, 0.1, ROOM_H, ROOM_D, MAT_WALL));
  meshes.push(placeCube( HALF_W + 0.05, ROOM_H/2, 0, 0.1, ROOM_H, ROOM_D, MAT_WALL));
  meshes.push(placeCube(0, ROOM_H/2, -HALF_D - 0.05, ROOM_W, ROOM_H, 0.1, MAT_WALL));
  meshes.push(placeCube(0, ROOM_H/2,  HALF_D + 0.05, ROOM_W, ROOM_H, 0.1, MAT_WALL));

  // Shelves on long walls
  const SHELF_DEPTH = 0.3, SHELF_WIDTH = 2.0, SHELF_HEIGHT = 1.0;
  const SHELF_GAP = 1.0, SHELF_BODY = 0.04;
  const SHELF_X = HALF_W - SHELF_DEPTH - 0.05;

  function rand(min, max) { return min + Math.random() * (max - min); }

  // Hoisted so the optional second lamp can use it
  const totalWidth = 3 * SHELF_WIDTH + 2 * SHELF_GAP;
  const zStart = -totalWidth / 2 + SHELF_WIDTH / 2;

  for (let side = 0; side < 2; side++) {
    const wallX = (side === 0 ? -1 : 1) * SHELF_X;
    const shelfZs = [];
    for (let i = 0; i < 3; i++) {
      shelfZs.push(zStart + i * (SHELF_WIDTH + SHELF_GAP));
    }
    const rowYs = [0.5, 2.0];
    for (let row = 0; row < 2; row++) {
      for (let s = 0; s < 3; s++) {
        const z = shelfZs[s];
        const yBase = rowYs[row];

        // 5 shelf planks
        meshes.push(placeCube(wallX, yBase, z, SHELF_DEPTH, SHELF_BODY, SHELF_WIDTH, MAT_SHELF));
        meshes.push(placeCube(wallX, yBase + SHELF_HEIGHT - SHELF_BODY, z, SHELF_DEPTH, SHELF_BODY, SHELF_WIDTH, MAT_SHELF));
        meshes.push(placeCube(
          wallX - (side === 0 ? -SHELF_DEPTH/2 + SHELF_BODY/2 : SHELF_DEPTH/2 - SHELF_BODY/2),
          yBase + SHELF_HEIGHT/2, z,
          SHELF_BODY, SHELF_HEIGHT, SHELF_WIDTH, MAT_SHELF
        ));
        meshes.push(placeCube(wallX, yBase + SHELF_HEIGHT/2, z - SHELF_WIDTH/2 + SHELF_BODY/2, SHELF_DEPTH, SHELF_HEIGHT, SHELF_BODY, MAT_SHELF));
        meshes.push(placeCube(wallX, yBase + SHELF_HEIGHT/2, z + SHELF_WIDTH/2 - SHELF_BODY/2, SHELF_DEPTH, SHELF_HEIGHT, SHELF_BODY, MAT_SHELF));

        // Books
        const bookCount = 8 + Math.floor(Math.random() * 8);
        let cursor = -SHELF_WIDTH/2 + 0.05;
        for (let b = 0; b < bookCount; b++) {
          const bw = rand(0.025, 0.045);
          const bh = rand(0.20, 0.30);
          const bd = rand(0.15, 0.22);
          const yOffset = rand(0, 0.05);
          if (cursor + bw > SHELF_WIDTH/2 - 0.05) break;
          const bookX = wallX + (side === 0 ? SHELF_DEPTH/2 - bd/2 - SHELF_BODY : -(SHELF_DEPTH/2 - bd/2 - SHELF_BODY));
          const bookY = yBase + SHELF_BODY + bh/2 + yOffset;
          const bookZ = cursor + bw/2;
          // 10% of books are accent
          const isAccent = Math.random() < 0.10;
          meshes.push(placeCube(bookX, bookY, bookZ, bd, bh, bw, isAccent ? MAT_BOOK_ACCENT : MAT_BOOK_DARK));
          cursor += bw + rand(0.001, 0.005);
        }
      }
    }
  }

  // Desk (in front of camera)
  meshes.push(placeCube(0, 0.74, -2.0, 1.2, 0.04, 0.6, MAT_DESK));
  meshes.push(placeCube(-0.55, 0.37, -2.0 - 0.27, 0.04, 0.74, 0.04, MAT_DESK));
  meshes.push(placeCube( 0.55, 0.37, -2.0 - 0.27, 0.04, 0.74, 0.04, MAT_DESK));
  meshes.push(placeCube(-0.55, 0.37, -2.0 + 0.27, 0.04, 0.74, 0.04, MAT_DESK));
  meshes.push(placeCube( 0.55, 0.37, -2.0 + 0.27, 0.04, 0.74, 0.04, MAT_DESK));

  // Chair (behind camera)
  meshes.push(placeCube(0, 0.45, -3.0, 0.5, 0.04, 0.5, MAT_DESK));
  meshes.push(placeCube(0, 0.9, -3.0 - 0.22, 0.5, 0.8, 0.04, MAT_DESK));

  // Lamp
  const LAMP_POS = [0, 2.5, 1.5];
  const LAMP_RADIUS = 0.10;  // a bit bigger so it reads
  const lampSphere = makeSphere(LAMP_RADIUS, 16, 12, MAT_LAMP);
  {
    const v = lampSphere.vertices;
    for (let i = 0; i < v.length; i += 7) {
      v[i + 0] += LAMP_POS[0];
      v[i + 1] += LAMP_POS[1];
      v[i + 2] += LAMP_POS[2];
    }
  }
  meshes.push(lampSphere);

  // ---------- Merge and upload ----------

  const merged = mergeMeshes(meshes);
  const triangleCount = merged.indices.length / 3;
  console.log('[library] triangles:', triangleCount, 'verts:', merged.vertices.length / 7);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, merged.vertices, gl.STATIC_DRAW);

  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, merged.indices, gl.STATIC_DRAW);

  // ---------- Shaders ----------

  function compileShader(type, source) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[library] shader compile error:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  async function loadShaderText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`failed to load ${url}: ${res.status}`);
    return await res.text();
  }

  // ---------- Matrix math (minimal) ----------

  function mat4Identity() {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  }

  function mat4Perspective(fovY, aspect, near, far) {
    const f = 1.0 / Math.tan(fovY / 2);
    const nf = 1.0 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  }

  function mat4LookAt(eye, target, up) {
    let fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2];
    let fl = Math.hypot(fx, fy, fz);
    fx /= fl; fy /= fl; fz /= fl;
    let rx = fy * up[2] - fz * up[1];
    let ry = fz * up[0] - fx * up[2];
    let rz = fx * up[1] - fy * up[0];
    const rl = Math.hypot(rx, ry, rz);
    rx /= rl; ry /= rl; rz /= rl;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;
    return new Float32Array([
      rx, ux, -fx, 0,
      ry, uy, -fy, 0,
      rz, uz, -fz, 0,
      -(rx*eye[0] + ry*eye[1] + rz*eye[2]),
      -(ux*eye[0] + uy*eye[1] + uz*eye[2]),
       (fx*eye[0] + fy*eye[1] + fz*eye[2]),
       1,
    ]);
  }

  function multiplyMat4(a, b) {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i * 4 + j] =
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
    return out;
  }

  // ---------- Render loop ----------

  const CAMERA_BASE = [0, 1.6, -2.5];
  const CAMERA_TARGET_BASE = [0, 1.5, 4];
  const LAMP_COLOR = [0.957, 0.847, 0.537];

  let projection = mat4Perspective(
    (75 * Math.PI) / 180,
    window.innerWidth / window.innerHeight,
    0.1, 50
  );

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    projection = mat4Perspective(
      (75 * Math.PI) / 180,
      canvas.width / canvas.height,
      0.1, 50
    );
  }
  window.addEventListener('resize', resize);
  resize();

  let program = null;
  let uniforms = {};

  (async () => {
    const [vertSrc, fragSrc] = await Promise.all([
      loadShaderText(new URL('./library.vert', import.meta.url).href),
      loadShaderText(new URL('./library.frag', import.meta.url).href),
    ]);
    const vs = compileShader(gl.VERTEX_SHADER, vertSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return;
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[library] link error:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // 7 floats per vertex: x, y, z, nx, ny, nz, materialId
    const aPos = gl.getAttribLocation(program, 'a_position');
    const aNormal = gl.getAttribLocation(program, 'a_normal');
    const aMaterial = gl.getAttribLocation(program, 'a_material');
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 28, 12);
    if (aMaterial >= 0) {
      gl.enableVertexAttribArray(aMaterial);
      gl.vertexAttribPointer(aMaterial, 1, gl.FLOAT, false, 28, 24);
    }

    uniforms.uViewProjection = gl.getUniformLocation(program, 'u_viewProjection');
    uniforms.uModel = gl.getUniformLocation(program, 'u_model');
    uniforms.uCameraPos = gl.getUniformLocation(program, 'u_cameraPos');
    uniforms.uLampPos = gl.getUniformLocation(program, 'u_lampPos');
    uniforms.uLampColor = gl.getUniformLocation(program, 'u_lampColor');
    uniforms.uLampIntensity = gl.getUniformLocation(program, 'u_lampIntensity');
    uniforms.uAmbient = gl.getUniformLocation(program, 'u_ambient');

    requestAnimationFrame(loop);
  })();

  // Debug: keyboard controls (will be removed for the real build)
  window.__libraryYaw = 0;
  window.__libraryPitch = 0;
  window.addEventListener('keydown', (e) => {
    const step = 8;
    if (e.key === 'ArrowLeft')  window.__libraryYaw -= step;
    if (e.key === 'ArrowRight') window.__libraryYaw += step;
    if (e.key === 'ArrowUp')    window.__libraryPitch -= step;
    if (e.key === 'ArrowDown')  window.__libraryPitch += step;
    if (e.key === '0') { window.__libraryYaw = 0; window.__libraryPitch = 0; }
    console.log('[library] yaw=', window.__libraryYaw, 'pitch=', window.__libraryPitch);
  });

  const startTime = performance.now();

  function loop(now) {
    if (document.hidden) {
      requestAnimationFrame(loop);
      return;
    }
    if (!program) {
      requestAnimationFrame(loop);
      return;
    }

    const t = (now - startTime) / 1000;

    // Camera breathing + manual yaw/pitch
    const yawRad = Math.sin(t * 2 * Math.PI / 8) * (0.5 * Math.PI / 180);
    const manualYaw = (window.__libraryYaw || 0) * Math.PI / 180;
    const manualPitch = (window.__libraryPitch || 0) * Math.PI / 180;
    const totalYaw = yawRad + manualYaw;
    const cosY = Math.cos(totalYaw), sinY = Math.sin(totalYaw);
    const cosP = Math.cos(manualPitch), sinP = Math.sin(manualPitch);
    const dx = CAMERA_TARGET_BASE[0] - CAMERA_BASE[0];
    const dy = CAMERA_TARGET_BASE[1] - CAMERA_BASE[1];
    const dz = CAMERA_TARGET_BASE[2] - CAMERA_BASE[2];
    const x1 = dx * cosY - dz * sinY;
    const z1 = dx * sinY + dz * cosY;
    const y2 = dy * cosP - z1 * sinP;
    const z2 = dy * sinP + z1 * cosP;
    const targetX = CAMERA_BASE[0] + x1;
    const targetY = CAMERA_BASE[1] + y2;
    const targetZ = CAMERA_BASE[2] + z2;
    const view = mat4LookAt(CAMERA_BASE, [targetX, targetY, targetZ], [0, 1, 0]);

    const lampIntensity = 0.95 + 0.05 * Math.sin(t * 2 * Math.PI / 4);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.055, 0.055, 0.055, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(uniforms.uViewProjection, false, multiplyMat4(projection, view));
    gl.uniformMatrix4fv(uniforms.uModel, false, mat4Identity());
    gl.uniform3fv(uniforms.uCameraPos, CAMERA_BASE);
    gl.uniform3fv(uniforms.uLampPos, LAMP_POS);
    gl.uniform3fv(uniforms.uLampColor, LAMP_COLOR);
    gl.uniform1f(uniforms.uLampIntensity, lampIntensity);
    gl.uniform1f(uniforms.uAmbient, 0.20);

    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, merged.indices.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(loop);
  }
  } catch (err) {
    console.error('[library] caught error:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
  }
})();
