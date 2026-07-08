// echo-library — procedural 3D library, Round 1 of v3.
// Geometry + camera + lamp. No sonar, no pulse, no time-of-flight.
//
// One WebGL 2.0 canvas, one mesh (a merged Float32Array of
// positions+normals), one index buffer, one draw call per frame.
// The fragment shader does traditional lighting: ambient + one point
// light (the lamp) + fog.
//
// Loaded only on post pages (the home and legacy pages are JS-free).
// Graceful fallback: if WebGL 2 is unavailable, the canvas stays
// empty and the dark post page reads on its own (the post text on
// the dark page is the v3 Stage 1 fallback).

(function () {
  'use strict';

  const canvas = document.querySelector('.library-3d');
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) {
    // No WebGL 2. The post page still works on a dark background.
    console.warn('[library] WebGL 2 unavailable; static dark fallback.');
    return;
  }

  // ---------- Geometry helpers ----------

  // Build a unit cube (1x1x1) centered at origin. Caller places it via
  // u_model. Each face has its own 4 vertices so normals are correct.
  function makeCube() {
    // 6 faces, each 4 vertices. Position + normal per vertex = 6 floats.
    // Faces: +X, -X, +Y, -Y, +Z, -Z.
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
        verts.push(face.v[i][0], face.v[i][1], face.v[i][2],
                   face.n[0], face.n[1], face.n[2]);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return { vertices: new Float32Array(verts), indices: new Uint16Array(indices) };
  }

  // Build a UV sphere of given radius centered at origin.
  // Used for the lamp. Segments × rings.
  function makeSphere(radius, segments, rings) {
    const verts = [];
    const indices = [];
    for (let r = 0; r <= rings; r++) {
      const v = r / rings;
      const phi = v * Math.PI;          // 0..PI (top to bottom)
      for (let s = 0; s <= segments; s++) {
        const u = s / segments;
        const theta = u * 2 * Math.PI;  // 0..2PI
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);
        // Position
        verts.push(x * radius, y * radius, z * radius);
        // Normal (unit sphere so position == normal)
        verts.push(x, y, z);
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

  // Concatenate multiple meshes into one merged buffer. Returns
  // { vertices, indices } with indices re-offset.
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
      vCount += m.vertices.length / 6;  // 6 floats per vertex
    }
    return { vertices: outV, indices: outI };
  }

  // Place a cube at center (cx, cy, cz) with size (sx, sy, sz).
  // The cube mesh is unit-cube (-0.5..+0.5) and the model matrix in
  // the shader is identity for the merged mesh, so we bake the
  // transform into vertex positions at build time.
  function placeCube(cx, cy, cz, sx, sy, sz) {
    const base = makeCube();
    const v = base.vertices;
    for (let i = 0; i < v.length; i += 6) {
      v[i + 0] = v[i + 0] * sx + cx;
      v[i + 1] = v[i + 1] * sy + cy;
      v[i + 2] = v[i + 2] * sz + cz;
      // Normals unchanged (no rotation, only translation+scale)
    }
    return base;
  }

  // ---------- Scene construction ----------

  const ROOM_W = 12;   // x extent
  const ROOM_D = 8;    // z extent
  const ROOM_H = 4;    // y extent
  const HALF_W = ROOM_W / 2;
  const HALF_D = ROOM_D / 2;

  const meshes = [];

  // Floor: a single 12x8 plane at y=0. Use a thin cube.
  meshes.push(placeCube(0, -0.05, 0, ROOM_W, 0.1, ROOM_D));

  // Ceiling: 12x8 plane at y=ROOM_H
  meshes.push(placeCube(0, ROOM_H + 0.05, 0, ROOM_W, 0.1, ROOM_D));

  // Walls: long walls (X direction) and short walls (Z direction).
  // We make them 0.1m thick for proper normals.
  meshes.push(placeCube(-HALF_W - 0.05, ROOM_H/2, 0, 0.1, ROOM_H, ROOM_D));  // left
  meshes.push(placeCube( HALF_W + 0.05, ROOM_H/2, 0, 0.1, ROOM_H, ROOM_D));  // right
  meshes.push(placeCube(0, ROOM_H/2, -HALF_D - 0.05, ROOM_W, ROOM_H, 0.1));  // back (behind camera)
  meshes.push(placeCube(0, ROOM_H/2,  HALF_D + 0.05, ROOM_W, ROOM_H, 0.1));  // front

  // Shelves: 12 shelf units total. 2 long walls × 2 rows high × 3
  // shelves per row. Each shelf is 0.3m deep × 2m wide × 1m tall.
  // They line the inside faces of the long walls (x = ±(HALF_W - 0.35)).
  // Gaps of 1m between shelves.
  const SHELF_DEPTH = 0.3;
  const SHELF_WIDTH = 2.0;
  const SHELF_HEIGHT = 1.0;
  const SHELF_GAP = 1.0;  // gap between shelves on the same wall
  const SHELF_BODY = 0.04;  // shelf plank thickness
  const SHELF_X = HALF_W - SHELF_DEPTH - 0.05;  // x-coord of inner face

  // Random books helper
  function rand(min, max) { return min + Math.random() * (max - min); }

  const booksPerShelfTotal = [];  // for diagnostics

  for (let side = 0; side < 2; side++) {
    // side: 0 = left wall (x = -SHELF_X), 1 = right wall (x = +SHELF_X)
    const wallX = (side === 0 ? -1 : 1) * SHELF_X;

    // z positions of the 3 shelves on this wall, evenly spaced
    const totalWidth = 3 * SHELF_WIDTH + 2 * SHELF_GAP;
    const zStart = -totalWidth / 2 + SHELF_WIDTH / 2;
    const shelfZs = [];
    for (let i = 0; i < 3; i++) {
      shelfZs.push(zStart + i * (SHELF_WIDTH + SHELF_GAP));
    }

    // y positions of the 2 rows (lower row at y=0.5..1.5, upper at y=2.0..3.0)
    const rowYs = [0.5, 2.0];

    for (let row = 0; row < 2; row++) {
      for (let s = 0; s < 3; s++) {
        const z = shelfZs[s];
        const yBase = rowYs[row];

        // Shelf body: 4 thin planks (top, bottom, left, right side of
        // the box) + a back. The "books" sit on the bottom plank.
        // For visual simplicity, model as a top + bottom + back only.

        // Bottom plank
        meshes.push(placeCube(
          wallX, yBase, z,
          SHELF_DEPTH, SHELF_BODY, SHELF_WIDTH
        ));
        // Top plank
        meshes.push(placeCube(
          wallX, yBase + SHELF_HEIGHT - SHELF_BODY, z,
          SHELF_DEPTH, SHELF_BODY, SHELF_WIDTH
        ));
        // Back plank (the wall side of the shelf)
        meshes.push(placeCube(
          wallX - (side === 0 ? -SHELF_DEPTH/2 + SHELF_BODY/2 : SHELF_DEPTH/2 - SHELF_BODY/2),
          yBase + SHELF_HEIGHT/2, z,
          SHELF_BODY, SHELF_HEIGHT, SHELF_WIDTH
        ));
        // Left side
        meshes.push(placeCube(
          wallX, yBase + SHELF_HEIGHT/2, z - SHELF_WIDTH/2 + SHELF_BODY/2,
          SHELF_DEPTH, SHELF_HEIGHT, SHELF_BODY
        ));
        // Right side
        meshes.push(placeCube(
          wallX, yBase + SHELF_HEIGHT/2, z + SHELF_WIDTH/2 - SHELF_BODY/2,
          SHELF_DEPTH, SHELF_HEIGHT, SHELF_BODY
        ));

        // Books: 8-15 per shelf. Walk along the front edge of the
        // shelf from one side to the other, placing books.
        const bookCount = 8 + Math.floor(Math.random() * 8);
        booksPerShelfTotal.push(bookCount);
        let cursor = -SHELF_WIDTH/2 + 0.05;  // start at left edge
        for (let b = 0; b < bookCount; b++) {
          const bw = rand(0.025, 0.045);
          const bh = rand(0.20, 0.30);
          const bd = rand(0.15, 0.22);
          const yOffset = rand(0, 0.05);
          if (cursor + bw > SHELF_WIDTH/2 - 0.05) break;  // ran out of room
          // Book sits on the bottom plank, against the back.
          // x is along shelf depth (front-to-back); z is along width.
          // We orient books so the spine faces into the room.
          const bookX = wallX + (side === 0 ? SHELF_DEPTH/2 - bd/2 - SHELF_BODY : -(SHELF_DEPTH/2 - bd/2 - SHELF_BODY));
          const bookY = yBase + SHELF_BODY + bh/2 + yOffset;
          const bookZ = cursor + bw/2;
          meshes.push(placeCube(bookX, bookY, bookZ, bd, bh, bw));
          cursor += bw + rand(0.001, 0.005);  // tight packing with a tiny gap
        }
      }
    }
  }

  // Reading furniture: a desk in front of the camera position
  // (camera is at z=-2.5; desk is 0.5m in front of camera, so z=-2.0).
  // Desk: 1.2m wide (x) × 0.6m deep (z) × 0.75m tall (y).
  meshes.push(placeCube(0, 0.74, -2.0, 1.2, 0.04, 0.6));  // top
  meshes.push(placeCube(-0.55, 0.37, -2.0 - 0.27, 0.04, 0.74, 0.04));  // leg FL
  meshes.push(placeCube( 0.55, 0.37, -2.0 - 0.27, 0.04, 0.74, 0.04));  // leg FR
  meshes.push(placeCube(-0.55, 0.37, -2.0 + 0.27, 0.04, 0.74, 0.04));  // leg BL
  meshes.push(placeCube( 0.55, 0.37, -2.0 + 0.27, 0.04, 0.74, 0.04));  // leg BR

  // Chair behind the camera. Not visible in camera view but present
  // so the room feels inhabited. Just a simple box at z=-3.0.
  meshes.push(placeCube(0, 0.45, -3.0, 0.5, 0.04, 0.5));   // seat
  meshes.push(placeCube(0, 0.9, -3.0 - 0.22, 0.5, 0.8, 0.04));  // back

  // Lamp: a sphere at (0, 2.5, 1.5). The shader uses u_lampPos
  // directly for the point light, so this sphere is purely a
  // visual cue; the light comes from u_lampPos in world space.
  const LAMP_POS = [0, 2.5, 1.5];
  const LAMP_RADIUS = 0.08;
  const lampSphere = makeSphere(LAMP_RADIUS, 16, 12);
  {
    // Translate sphere to lamp position
    const v = lampSphere.vertices;
    for (let i = 0; i < v.length; i += 6) {
      v[i + 0] += LAMP_POS[0];
      v[i + 1] += LAMP_POS[1];
      v[i + 2] += LAMP_POS[2];
    }
  }
  meshes.push(lampSphere);

  // Optional second lamp (30% chance). Placed on a shelf with a
  // softer glow. For Round 1, we just add the geometry; the second
  // lamp's contribution to the shader is not yet wired up. Round 2
  // will fully integrate multi-lamp lighting. For now, the second
  // lamp is a visual element only.
  if (Math.random() < 0.3) {
    // Place a small sphere on a random shelf (we'll just pick a
    // midpoint of the second-row right-side shelf).
    const x2 = SHELF_X - 0.1;  // slightly forward of the shelf
    const y2 = 2.0 + SHELF_HEIGHT / 2;
    const z2 = zStart + 1 * (SHELF_WIDTH + SHELF_GAP);
    const lamp2 = makeSphere(0.05, 12, 8);
    const v = lamp2.vertices;
    for (let i = 0; i < v.length; i += 6) {
      v[i + 0] += x2;
      v[i + 1] += y2;
      v[i + 2] += z2;
    }
    meshes.push(lamp2);
  }

  // ---------- Merge and upload ----------

  const merged = mergeMeshes(meshes);
  const triangleCount = merged.indices.length / 3;
  console.log('[library] triangles:', triangleCount, 'verts:', merged.vertices.length / 6);

  // VAO
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Position + normal interleaved: 6 floats per vertex.
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
    // Forward = normalize(target - eye)
    let fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2];
    let fl = Math.hypot(fx, fy, fz);
    fx /= fl; fy /= fl; fz /= fl;
    // Right = normalize(forward × up)
    let rx = fy * up[2] - fz * up[1];
    let ry = fz * up[0] - fx * up[2];
    let rz = fx * up[1] - fy * up[0];
    const rl = Math.hypot(rx, ry, rz);
    rx /= rl; ry /= rl; rz /= rl;
    // True up = right × forward
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

  // ---------- Render loop ----------

  const CAMERA_BASE = [0, 1.6, -2.5];
  const CAMERA_TARGET_BASE = [0, 1.5, 4];
  const LAMP_COLOR = [0.957, 0.847, 0.537];  // #f4d889 normalized

  let projection = mat4Perspective(
    (75 * Math.PI) / 180,  // 75° vertical FOV
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
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    projection = mat4Perspective(
      (75 * Math.PI) / 180,
      canvas.width / canvas.height,
      0.1, 50
    );
  }
  window.addEventListener('resize', resize);
  resize();

  // Initialize program. Wait for shaders to load.
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

    // Set up attribute pointers (position + normal, 6 floats per vertex)
    const aPos = gl.getAttribLocation(program, 'a_position');
    const aNormal = gl.getAttribLocation(program, 'a_normal');
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 24, 12);

    // Uniform locations
    uniforms.uViewProjection = gl.getUniformLocation(program, 'u_viewProjection');
    uniforms.uModel = gl.getUniformLocation(program, 'u_model');
    uniforms.uCameraPos = gl.getUniformLocation(program, 'u_cameraPos');
    uniforms.uLampPos = gl.getUniformLocation(program, 'u_lampPos');
    uniforms.uLampColor = gl.getUniformLocation(program, 'u_lampColor');
    uniforms.uLampIntensity = gl.getUniformLocation(program, 'u_lampIntensity');
    uniforms.uAmbient = gl.getUniformLocation(program, 'u_ambient');

    requestAnimationFrame(loop);
  })();

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

    const t = (now - startTime) / 1000;  // seconds

    // Camera breathing: 0.5° horizontal sway, 8s period.
    const yawRad = Math.sin(t * 2 * Math.PI / 8) * (0.5 * Math.PI / 180);
    const cosY = Math.cos(yawRad), sinY = Math.sin(yawRad);
    // Rotate the lookAt target around the camera on Y axis.
    const dx = CAMERA_TARGET_BASE[0] - CAMERA_BASE[0];
    const dz = CAMERA_TARGET_BASE[2] - CAMERA_BASE[2];
    const targetX = CAMERA_BASE[0] + dx * cosY - dz * sinY;
    const targetZ = CAMERA_BASE[2] + dx * sinY + dz * cosY;
    const view = mat4LookAt(CAMERA_BASE, [targetX, CAMERA_TARGET_BASE[1], targetZ], [0, 1, 0]);

    // Lamp flicker: 0.95..1.0 over a 4s period.
    const lampIntensity = 0.95 + 0.05 * Math.sin(t * 2 * Math.PI / 4);

    // Clear
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.055, 0.055, 0.055, 1.0);  // matches the page bg
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Set uniforms
    gl.uniformMatrix4fv(uniforms.uViewProjection, false, multiplyMat4(projection, view));
    gl.uniformMatrix4fv(uniforms.uModel, false, mat4Identity());
    gl.uniform3fv(uniforms.uCameraPos, CAMERA_BASE);
    gl.uniform3fv(uniforms.uLampPos, LAMP_POS);
    gl.uniform3fv(uniforms.uLampColor, LAMP_COLOR);
    gl.uniform1f(uniforms.uLampIntensity, lampIntensity);
    gl.uniform1f(uniforms.uAmbient, 0.04);

    // Draw
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, merged.indices.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(loop);
  }

  // Matrix multiply: out = a * b (column-major, Float32Array[16])
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
})();
