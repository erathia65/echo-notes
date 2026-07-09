#version 300 es
// SOLID COLOR TEST: ignore all lighting, all materials, all math.
// Output red. If the screen is red, geometry is reaching fragments.
// If still black, the issue is in the vertex shader, model matrix,
// or camera (not the lighting).

precision highp float;

in vec3 v_worldPos;
in vec3 v_normal;
in float v_material;

out vec4 outColor;

void main() {
  outColor = vec4(1.0, 0.0, 0.0, 1.0);
}
