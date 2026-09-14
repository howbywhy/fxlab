/* ---------------- Print modules ---------------- */

/* ---- Print texture ---- */
FX.register({ id:'trt-press', name:'Print texture', cat:'treatment', desc:'Makes digital art feel printed: paper colour and grain, fibres, ink spread, uneven coverage and plate misregistration.',
  params:[ C('paper','Paper','#f2eee4', false), T('multiply','Print onto paper colour',true), R('grain','Paper grain',.35,0,1), R('fibre','Fibres',.25,0,1), R('spread','Ink spread',1,0,4), R('mottle','Uneven ink',.15,0,1), R('misreg','Misregistration',1.5,0,10), T('animate','Animate grain',false) ],
  fs:`vec4 fx(vec2 uv){
  vec2 px = 1. / uRes;
  vec2 o = vec2(p_misreg) * px;
  vec3 c = vec3(texture(uInput, uv + o * vec2(1., .35)).r, texture(uInput, uv).g, texture(uInput, uv - o * vec2(.45, 1.)).b);
  if (p_spread > 0.){
    vec2 s = px * p_spread;
    vec3 n = (texture(uInput, uv + vec2(s.x, 0.)).rgb + texture(uInput, uv - vec2(s.x, 0.)).rgb + texture(uInput, uv + vec2(0., s.y)).rgb + texture(uInput, uv - vec2(0., s.y)).rgb) * .25;
    c = mix(c, min(c, n), .55);
  }
  float seed = p_animate > .5 ? floor(uTime * 12.) : 0.;
  float ink = 1. - luma(c);
  float mott = (fbm(uv * uRes / 28. + seed * .1) - .5) * p_mottle * 1.2;
  c = mix(c, vec3(1.), clamp(mott * ink, 0., .35));
  vec3 paper = p_paper;
  if (p_multiply > .5) c *= paper;
  float grain = (hash12(floor(uv * uRes) + seed) - .5) * p_grain * .22;
  float fib = (vnoise(vec2(uv.x * uRes.x / 2.5, uv.y * uRes.y / 70.) + seed) - .5) * p_fibre * .12 + (vnoise(vec2(uv.x * uRes.x / 80., uv.y * uRes.y / 3.)) - .5) * p_fibre * .06;
  c += grain + fib;
  return vec4(clamp(c, 0., 1.), 1.);
}` });
