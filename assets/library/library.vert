#version 300 es
// Vertex shader: passthrough. 7 floats per vertex: x, y, z, nx, ny, nz, materialId.

in vec3 a_position;
in vec3 a_normal;
in float a_material;

uniform mat4 u_viewProjection;
uniform mat4 u_model;

out vec3 v_worldPos;
out vec3 v_normal;
out float v_material;

void main() {
  vec4 worldPos = u_model * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal = normalize(mat3(u_model) * a_normal);
  v_material = a_material;
  gl_Position = u_viewProjection * worldPos;
}
