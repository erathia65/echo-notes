#version 300 es
// Fragment shader: CRASH TEST brightness — the room is supposed to
// be barely visible, but right now we want to see anything at all.
// This is a debug version; will be tuned back down once the scene
// is verified.

precision highp float;

in vec3 v_worldPos;
in vec3 v_normal;

uniform vec3 u_cameraPos;
uniform vec3 u_lampPos;
uniform vec3 u_lampColor;
uniform float u_lampIntensity;
uniform float u_ambient;

out vec4 outColor;

void main() {
  vec3 N = normalize(v_normal);

  // Strong ambient so the room is fully visible
  vec3 ambient = vec3(u_ambient);

  // Point light from the lamp
  vec3 toLamp = u_lampPos - v_worldPos;
  float lampDist = length(toLamp);
  vec3 L = toLamp / max(lampDist, 0.0001);

  float ndl = max(dot(N, L), 0.0);

  // Soft falloff, generous reach
  float falloff = 1.0 / (0.2 + 0.2 * lampDist + 0.02 * lampDist * lampDist);

  // Bright surface tint
  vec3 surface = vec3(0.65, 0.58, 0.48);

  vec3 lampContribution = u_lampColor * ndl * falloff * u_lampIntensity;
  vec3 color = ambient * surface + surface * lampContribution;

  // Lamp itself glows strongly
  float lampProximity = 1.0 / (0.05 + 0.2 * lampDist * lampDist);
  color += u_lampColor * lampProximity * 2.0 * u_lampIntensity;

  // Mild fog
  float fogDist = length(v_worldPos - u_cameraPos);
  float fog = clamp((fogDist - 8.0) / 20.0, 0.0, 0.5);
  vec3 fogColor = vec3(0.055, 0.055, 0.055);
  color = mix(color, fogColor, fog);

  outColor = vec4(color, 1.0);
}
