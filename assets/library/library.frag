#version 300 es
// Fragment shader: traditional lit scene for Round 1 of v3.
// One ambient term + one point light (the lamp) per fragment.
// No sonar, no pulse, no time-of-flight. That's Round 2.
//
// The room is dark except where the lamp's light reaches.
// The lamp itself glows from within (an additive sphere around its position).

in vec3 v_worldPos;
in vec3 v_normal;

uniform vec3 u_cameraPos;       // camera world position
uniform vec3 u_lampPos;         // lamp world position
uniform vec3 u_lampColor;       // lamp emission color
uniform float u_lampIntensity;  // current lamp brightness (0.9..1.0)
uniform float u_ambient;        // very low ambient so the room is barely visible

out vec4 outColor;

void main() {
  vec3 N = normalize(v_normal);

  // Ambient: a tiny base level so the geometry is barely visible
  // even where the lamp doesn't reach. Spec calls for "barely visible".
  vec3 ambient = vec3(u_ambient);

  // Point light contribution from the lamp.
  vec3 toLamp = u_lampPos - v_worldPos;
  float lampDist = length(toLamp);
  vec3 L = toLamp / max(lampDist, 0.0001);

  // Diffuse term: surfaces facing the lamp catch more light.
  float ndl = max(dot(N, L), 0.0);

  // Inverse-square falloff. Softened with a small constant to keep
  // the lamp's reach readable rather than vanishing in 1m.
  float falloff = 1.0 / (0.3 + 0.5 * lampDist + 0.08 * lampDist * lampDist);

  // Surface tint: very dark gray-brown. Per-vertex color would be
  // better but for Round 1 a single material is fine.
  vec3 surface = vec3(0.18, 0.16, 0.13);

  vec3 lampContribution = u_lampColor * ndl * falloff * u_lampIntensity;
  vec3 color = ambient * surface + surface * lampContribution;

  // If this fragment is very close to the lamp center, add a glow
  // term so the lamp itself reads as bright regardless of surface
  // normal. This is a hack for Round 1; Round 2 will replace with the
  // proper sonar shader.
  float lampProximity = 1.0 / (0.1 + 0.5 * lampDist * lampDist);
  color += u_lampColor * lampProximity * 0.6 * u_lampIntensity;

  // Distance fog: fade the back of the room into the page background.
  // (The page bg is near-black; the fog color matches.)
  float fogDist = length(v_worldPos - u_cameraPos);
  float fog = clamp((fogDist - 4.0) / 10.0, 0.0, 0.85);
  vec3 fogColor = vec3(0.055, 0.055, 0.055);
  color = mix(color, fogColor, fog);

  // Output. Note: WebGL alpha is opaque here.
  outColor = vec4(color, 1.0);
}
