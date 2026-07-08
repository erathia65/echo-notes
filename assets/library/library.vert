#version 300 es
// Vertex shader: passthrough for positions.
// Each vertex has a 3D position (x, y, z) and a 3D normal (nx, ny, nz).
// We transform the position to clip space and pass the world-space
// position and normal to the fragment shader for lighting.

in vec3 a_position;
in vec3 a_normal;

uniform mat4 u_viewProjection;
uniform mat4 u_model;

out vec3 v_worldPos;
out vec3 v_normal;

void main() {
  vec4 worldPos = u_model * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  // u_model is a pure rotation/translation (no non-uniform scale) so
  // we can use mat3(u_model) to transform normals.
  v_normal = normalize(mat3(u_model) * a_normal);
  gl_Position = u_viewProjection * worldPos;
}
