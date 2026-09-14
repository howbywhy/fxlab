const GLSL = (() => {
  const VS = `#version 300 es
in vec2 aPos; out vec2 vUv; uniform vec4 uTile;
void main(){ vUv = uTile.xy + (aPos * .5 + .5) * uTile.zw; gl_Position = vec4(aPos, 0., 1.); }`;

  const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uInput, uA, uB, uPrev, uAux;
uniform vec2 uRes;
uniform float uTime, uProgress, uLoop, uDur, uPx;
uniform vec4 uAuxInfo;
uniform vec4 uTile;  /* region of the full frame being rendered (tiled print renders); identity otherwise */
uniform vec3 uBack;  /* backdrop behind everything (the letterbox colour, or the transparent stand-in) */
uniform float uBackCheck;
/* the backdrop: a checkerboard while previewing transparency, otherwise a flat colour */
vec3 backdrop(vec2 uv){
  if (uBackCheck < .5) return uBack;
  vec2 c = floor(uv * uRes / 24.);
  return mix(vec3(.16, .165, .17), vec3(.245, .25, .26), mod(c.x + c.y, 2.));
}
/* uv is clamped to the frame so edge sampling matches a single-pass render */
vec4 tileTex(sampler2D s, vec2 uv){ return texture(s, (clamp(uv, 0., 1.) - uTile.xy) / uTile.zw); }
vec4 tileTexLod(sampler2D s, vec2 uv, float l){ return textureLod(s, (clamp(uv, 0., 1.) - uTile.xy) / uTile.zw, l); }
#define PI 3.14159265359
#define TAU 6.28318530718
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return v; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float aspect(){ return uRes.x / uRes.y; }
vec2 centered(vec2 uv){ return (uv - .5) * vec2(uRes.x / uRes.y, 1.); }
vec2 uncentered(vec2 p){ return p / vec2(uRes.x / uRes.y, 1.) + .5; }
vec2 mirrorUv(vec2 s){ return 1. - abs(1. - mod(s, 2.)); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(0., 2. / 3., 1. / 3.)) * 6. - 3.); return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0., -1. / 3., 2. / 3., -1.);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y); float e = 1e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6. * d + e)), d / (q.x + e), q.x); }
vec3 blendMode(vec3 a, vec3 b, int m){
  if (m == 1) return a * b;
  if (m == 2) return 1. - (1. - a) * (1. - b);
  if (m == 3) return mix(2. * a * b, 1. - 2. * (1. - a) * (1. - b), step(.5, a));
  if (m == 4) return mix(2. * a * b + a * a * (1. - 2. * b), sqrt(a) * (2. * b - 1.) + 2. * a * (1. - b), step(.5, b));
  if (m == 5) return mix(2. * a * b, 1. - 2. * (1. - a) * (1. - b), step(.5, b));
  if (m == 6) return abs(a - b);
  if (m == 7) return a + b - 2. * a * b;
  if (m == 8) return min(a + b, 1.);
  if (m == 9) return max(a - b, 0.);
  if (m == 10) return max(a, b);
  if (m == 11) return min(a, b);
  if (m == 12) return min(a / max(1. - b, 1e-3), 1.);
  if (m == 13) return 1. - min((1. - a) / max(b, 1e-3), 1.);
  return b;
}
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(.5 * a) * .25 + bayer2(a); }
float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float sdTri(vec2 p, float r){ float k = 1.7320508; p.x = abs(p.x) - r; p.y = p.y + r / k;
  if (p.x + k * p.y > 0.) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.;
  p.x -= clamp(p.x, -2. * r, 0.); return -length(p) * sign(p.y); }
`;

  function uniformDecls(params){
    return params.map(p => {
      if (p.type === 'color') return `uniform vec3 p_${p.id};\nuniform float p_${p.id}_a;`;   /* _a is the colour's opacity */
      if (p.type === 'text') return '';
      return `uniform float p_${p.id};`;
    }).join('\n');
  }
  /* the running frame (uInput, uPrev) may hold just one tile of a big print render, so module
     sampling is routed through tileTex; sources A/B and aux textures always cover the whole frame */
  const tileSafe = src => src
    .replace(/\btexture\s*\(\s*(uInput|uPrev)\s*,/g, 'tileTex($1,')
    .replace(/\btextureLod\s*\(\s*(uInput|uPrev)\s*,/g, 'tileTexLod($1,');
  function buildFS(m){
    return `${PRELUDE}\n${uniformDecls(m.params)}\n#line 1\n${tileSafe(m.fs)}\nvoid main(){ outColor = fx(vUv); }\n`;
  }
  return { VS, PRELUDE, buildFS };
})();
