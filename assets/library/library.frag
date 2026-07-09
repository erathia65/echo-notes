#version 300 es
// CRASH TEST: ignore all lighting. Output a position-based color so
// we can see the geometry is being drawn.

precision highp float;

in vec3 v_worldPos;
in vec3 v_normal;

out vec4 outColor;

void main() {
  // Color by world position: red = X, green = Y, blue = Z
  vec3 c = vec3(
    (v_worldPos.x + 6.0) / 12.0,   // x: 0..1 over the room width
    (v_worldPos.y) / 4.0,           // y: 0..1 over the room height
    (v_worldPos.z + 4.0) / 8.0      // z: 0..1 over the room depth
  );
  outColor = vec4(c, 1.0);
}
