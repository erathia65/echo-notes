#version 300 es
// Fragment shader: per-material base color + ambient + one point light.
// Materials (must match the JS materialId values):
//   0 = floor (dark wood)
//   1 = wall   (dark gray)
//   2 = shelf  (dark wood, like floor)
//   3 = book, dark
//   4 = book, accent red
//   5 = desk   (dark wood)
//   6 = lamp   (emissive warm color)

precision highp float;

in vec3 v_worldPos;
in vec3 v_normal;
in float v_material;

uniform vec3 u_cameraPos;
uniform vec3 u_lampPos;
uniform vec3 u_lampColor;
uniform float u_lampIntensity;
uniform float u_ambient;

out vec4 outColor;

vec3 materialBase(float id) {
  if (id < 0.5) return vec3(0.12, 0.094, 0.071);   // floor: dark wood
  if (id < 1.5) return vec3(0.10, 0.10, 0.10);     // wall: dark gray
  if (id < 2.5) return vec3(0.12, 0.094, 0.071);   // shelf: dark wood
  if (id < 3.5) return vec3(0.08, 0.07, 0.06);     // book dark
  if (id < 4.5) return vec3(0.50, 0.18, 0.12);     // book accent (warm red)
  if (id < 5.5) return vec3(0.12, 0.094, 0.071);   // desk: dark wood
  return vec3(0.96, 0.85, 0.54);                   // lamp: emissive warm
}

void main() {
  vec3 base = materialBase(v_material);

  // Lamp material: emissive, ignores lighting
  if (v_material > 5.5) {
    outColor = vec4(base * u_lampIntensity * 1.5, 1.0);
    return;
  }

  vec3 N = normalize(v_normal);
  vec3 L = u_lampPos - v_worldPos;
  float dist = length(L);
  L = L / max(dist, 0.0001);

  // Diffuse
  float ndl = max(dot(N, L), 0.0);

  // Inverse-square falloff with a softening constant
  float falloff = 1.0 / (1.0 + dist * dist * 0.5);

  // Ambient: low constant for the whole scene
  vec3 ambient = base * u_ambient;

  // Lamp contribution
  vec3 lamp = base * u_lampColor * ndl * falloff * u_lampIntensity * 1.4;

  vec3 color = ambient + lamp;

  // Mild distance fog
  float fogDist = length(v_worldPos - u_cameraPos);
  float fog = clamp((fogDist - 6.0) / 14.0, 0.0, 0.7);
  vec3 fogColor = vec3(0.055, 0.055, 0.055);
  color = mix(color, fogColor, fog);

  outColor = vec4(color, 1.0);
}
