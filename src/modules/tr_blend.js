/* ---------------- Transitions: blend ----------------
   Per-pixel colour blends and light passes between A and B. Each one starts exactly
   on A at progress 0 and lands exactly on B at 1; the character lives in the middle. */

FX.register({ id:'tr-hue-fade', name:'Hue crossfade', cat:'transition', search:['hsv', 'colour shift', 'rainbow', 'hue rotate'],
  desc:'Crossfades through hue, saturation and value instead of RGB, so colours travel round the wheel rather than going muddy.',
  params:[ S('route','Hue route',['Shortest way','Long way round','Extra full turn'],0), R('sat','Saturation lift',.35,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress;
  vec3 ha = rgb2hsv(a), hb = rgb2hsv(b);
  /* greys have no real hue: borrow the other image's so they don't swing through a random colour */
  if (ha.y < .02) ha.x = hb.x;
  if (hb.y < .02) hb.x = ha.x;
  float d = hb.x - ha.x;
  d -= floor(d + .5);
  int r = int(p_route + .5);
  if (r == 1) d = d >= 0. ? d - 1. : d + 1.;
  else if (r == 2) d += d >= 0. ? 1. : -1.;
  vec3 h = mix(ha, hb, p);
  h.x = fract(ha.x + d * p);
  h.y = clamp(h.y + p_sat * sin(p * PI) * (1. - h.y), 0., 1.);
  vec3 col = hsv2rgb(h);
  /* lock the ends to the sources so a cut lands on the exact pixels */
  col = mix(a, col, smoothstep(0., .02, p));
  col = mix(col, b, smoothstep(.98, 1., p));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-grey-dip', name:'Greyscale dip', cat:'transition', search:['desaturate', 'black and white', 'mono', 'fade to grey'],
  desc:'A drains to grey, the greys cross, and B comes back up into colour.',
  params:[ R('depth','Time in grey',.45,.05,.9), R('contrast','Grey contrast',1.15,.5,2), C('tint','Grey tint','#ffffff',false) ],
  fs:`vec3 greydip_g(vec3 c){
  float l = (luma(c) - .5) * p_contrast + .5;
  return clamp(l, 0., 1.) * p_tint;
}
vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress, i = p_depth;
  float lead = (1. - i) * .5;
  vec3 a2 = mix(a, greydip_g(a), smoothstep(0., lead + i * .25, p));
  vec3 b2 = mix(greydip_g(b), b, smoothstep(1. - lead - i * .25, 1., p));
  return vec4(mix(a2, b2, smoothstep(lead * .5, 1. - lead * .5, p)), 1.);
}` });

FX.register({ id:'tr-channel-fade', name:'Channel stagger fade', cat:'transition', search:['rgb', 'colour phase', 'separation', 'colour fade'],
  desc:'Red, green and blue each crossfade on their own clock, so the frame passes through colour casts on the way to B.',
  params:[ S('first','First channel',['Red','Green','Blue'],0), R('stagger','Stagger',.22,0,.45), T('reverse','Reverse order') ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float st = p_stagger;
  vec3 order = vec3(0., 1., 2.);
  int f = int(p_first + .5);
  /* rotate which channel leads */
  order = mod(order - float(f) + 3., 3.);
  if (p_reverse > .5) order = 2. - order;
  vec3 s0 = order * st, s1 = 1. - (2. - order) * st;
  vec3 m = smoothstep(s0, s1, vec3(uProgress));
  return vec4(mix(a, b, m), 1.);
}` });

FX.register({ id:'tr-blend-bridge', name:'Blend-mode bridge', cat:'transition', search:['multiply', 'screen', 'overlay', 'difference', 'double exposure', 'superimpose'],
  desc:'A turns into a blend of A and B, holds there, then resolves into B.',
  params:[ S('mode','Blend',['Multiply','Screen','Overlay','Soft light','Difference','Exclusion','Darken','Lighten'],2), R('hold','Hold on blend',.2,0,.7), R('amount','Blend strength',1,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  int sel = int(p_mode + .5);
  int m = sel == 0 ? 1 : sel == 1 ? 2 : sel == 2 ? 3 : sel == 3 ? 4 : sel == 4 ? 6 : sel == 5 ? 7 : sel == 6 ? 11 : 10;
  vec3 bl = mix(mix(a, b, .5), blendMode(a, b, m), p_amount);
  float p = uProgress, h = p_hold * .5;
  vec3 col = p < .5 ? mix(a, bl, smoothstep(0., .5 - h, p)) : mix(bl, b, smoothstep(.5 + h, 1., p));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-colour-distance', name:'Colour-distance reveal', cat:'transition', search:['similar', 'match', 'difference key', 'morph'],
  desc:'Pixels where A and B already agree switch first, and the most different areas follow last.',
  params:[ S('order','First to change',['Where they match','Where they differ'],0), R('soft','Softness',.08,.005,.4), R('tail','Final fade',4,1,10) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress;
  float d = clamp(distance(a, b) / 1.2, 0., 1.);
  if (p_order > .5) d = 1. - d;
  float s = p_soft;
  float thr = mix(-s, 1. + s, p);
  float m = 1. - smoothstep(thr - s, thr + s, d);
  m = max(m, pow(p, p_tail));
  return vec4(mix(a, b, m), 1.);
}` });

FX.register({ id:'tr-diff-fade', name:'Difference-paced fade', cat:'transition', search:['fade fast', 'fade slow', 'uneven fade', 'ffmpeg'],
  desc:'Each pixel fades at its own rate, set by how far A and B are apart there, so the dissolve runs unevenly across the frame.',
  params:[ S('lead','Leads the fade',['Matching areas','Differing areas'],0), R('strength','Strength',10,0,24), T('channels','Per channel',true) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 d = p_channels > .5 ? abs(a - b) : vec3(distance(a, b) / 1.732);
  vec3 e = 1. + p_strength * d * d * 2.;
  if (p_lead > .5) e = 1. / e;
  vec3 m = pow(vec3(uProgress), e);
  return vec4(mix(a, b, m), 1.);
}` });

FX.register({ id:'tr-additive', name:'Additive dissolve', cat:'transition', search:['overexposure', 'bright dissolve', 'hot dissolve', 'premiere'],
  desc:'Both images are added together, so the frame brightens through the middle instead of dipping.',
  params:[ R('strength','Strength',.3,0,2), T('roll','Soft highlights',true) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress, k = p_strength * sin(p * PI);
  vec3 x = a * (1. - p + k) + b * (p + k);
  /* soft roll keeps colour in the hot middle; it fades out at the ends so A and B stay exact */
  vec3 soft = 1. - exp(-x * 1.4);
  soft /= 1. - exp(-1.4);
  vec3 col = p_roll > .5 ? mix(min(x, 1.), min(soft, 1.), sin(p * PI)) : min(x, 1.);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-nonadditive', name:'Non-additive dissolve', cat:'transition', search:['lighten dissolve', 'max', 'premiere'],
  desc:'The brighter of the two images wins at each pixel, so B’s highlights break through first and its darks arrive last.',
  params:[ S('compare','Compare',['Each channel','Brightness'],0), R('soft','Softness',.06,0,.3) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress;
  vec3 wa = a * min(1., 2. * (1. - p)), wb = b * min(1., 2. * p);
  vec3 col;
  if (p_compare < .5){
    float s = max(p_soft, 1e-3);
    col = mix(wa, wb, smoothstep(-s, s, wb - wa));
  } else {
    float s = max(p_soft, 1e-3);
    float t = smoothstep(-s, s, luma(wb) - luma(wa));
    col = mix(wa, wb, t);
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-film-dissolve', name:'Film dissolve', cat:'transition', search:['linear light', 'gamma', 'optical', 'resolve'],
  desc:'Crossfades in light rather than in screen values, as an optical printer would, so the middle holds its brightness.',
  params:[ S('space','Blend in',['Linear light','Density (darker)'],0), R('gamma','Gamma',2.2,1,3) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress, g = p_gamma;
  vec3 la = pow(a, vec3(g)), lb = pow(b, vec3(g));
  vec3 l;
  if (p_space < .5) l = mix(la, lb, p);
  else l = exp(mix(log(la + 1e-3), log(lb + 1e-3), p)) - 1e-3;
  vec3 col = pow(max(l, 0.), vec3(1. / g));
  col = mix(a, col, smoothstep(0., .01, p));
  col = mix(col, b, smoothstep(.99, 1., p));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-tonal-dissolve', name:'Highlights-first dissolve', cat:'transition', search:['shadows first', 'luma', 'tonal', 'resolve'],
  desc:'A soft dissolve keyed on tone: the incoming highlights (or shadows) rise first and the rest of the range follows smoothly.',
  params:[ S('mode','Arrives first',['Highlights','Shadows'],0), S('key','Key from',['Incoming image','Both images'],0), R('spread','Tonal spread',.8,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float k = p_key > .5 ? (luma(b) + luma(a)) * .5 : luma(b);
  if (p_mode > .5) k = 1. - k;
  float s = p_spread;
  /* each tone gets a window of length 1-s, offset so the lead tone starts at 0 and the last ends at 1 */
  float start = (1. - k) * s;
  float t = clamp((uProgress - start) / max(1. - s, 1e-3), 0., 1.);
  t = t * t * (3. - 2. * t);
  return vec4(mix(a, b, t), 1.);
}` });

FX.register({ id:'tr-subtractive', name:'Subtractive dissolve', cat:'transition', search:['dark dissolve', 'linear burn', 'resolve'],
  desc:'The two images subtract into each other, so the frame darkens and deepens through the middle.',
  params:[ R('depth','Depth',.8,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress;
  /* additive in the inverse: whites hold, darks pile up into a linear burn at the midpoint */
  vec3 sub = 1. - min((1. - a) * min(1., 2. * (1. - p)) + (1. - b) * min(1., 2. * p), 1.);
  return vec4(mix(mix(a, b, p), sub, p_depth), 1.);
}` });

FX.register({ id:'tr-exposure-flash', name:'Exposure flash', cat:'transition', search:['dip to white', 'flash', 'overexpose', 'blow out', 'whiteout'],
  desc:'Exposure climbs until the highlights burn out to white, B is swapped in under the glare, then it comes back down.',
  params:[ R('stops','Peak stops',3.5,1,8), R('hold','Hold at peak',.1,0,.5), C('color','Flash colour','#ffffff',false) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress, h = p_hold * .5;
  float f = 1. - smoothstep(h, .5, abs(p - .5));
  f *= f; f *= f;
  vec3 c = mix(a, b, smoothstep(.5 - h - .04, .5 + h + .04, p));
  vec3 x = c * exp2(f * p_stops) * mix(vec3(1.), p_color, f);
  vec3 col = mix(min(x, 1.), p_color, smoothstep(.85, 1., f));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-flash-frame', name:'Flash frame', cat:'transition', search:['flash cut', 'strobe', 'white flash', 'invert', 'capcut'],
  desc:'A hard cut hidden under a burst of white, a colour or a negative that decays into B.',
  params:[ S('style','Flash',['Colour','Negative','Blown highlights'],0), C('color','Colour','#ffffff',false), R('length','Decay',.18,.03,.5), I('hits','Flashes',1,1,3) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress;
  vec3 c = p < .5 ? a : b;
  float L = p_length;
  float f;
  if (p < .5) f = exp(-(.5 - p) / (L * .12) * 3.);
  else {
    float q = (p - .5) / L;
    float n = max(p_hits, 1.);
    /* repeated hits inside the decay, each weaker than the last */
    float k = floor(q * n * 1.2);
    float local = fract(q * n * 1.2);
    f = k < n ? exp(-local * 4.) * pow(.6, k) : 0.;
    f *= 1. - smoothstep(.8, 1., q / 1.2 * 1.);
    f = max(f, exp(-q * 6.) * .15 * step(q, 1.2));
  }
  f = clamp(f, 0., 1.) * step(.002, p) * step(p, .999);
  int s = int(p_style + .5);
  vec3 col;
  if (s == 0) col = mix(c, p_color, f);
  else if (s == 1) col = mix(c, 1. - c, smoothstep(.15, .6, f)) + p_color * f * .15;
  else col = min(c * exp2(f * 5.), 1.);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-cross-blur', name:'Cross blur', cat:'transition', nonLocal:true, search:['defocus', 'blur dissolve', 'focus pull', 'blur through'],
  desc:'A drifts out of focus while it dissolves into an equally soft B, which then sharpens.',
  params:[ R('radius','Blur',.035,0,.12), S('shape','Blur shape',['Round','Horizontal','Vertical'],0), R('lift','Brightness lift',.05,0,.3) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, bump = sin(p * PI);
  float r = p_radius * bump;
  float fade = smoothstep(.3, .7, p);
  int sh = int(p_shape + .5);
  vec3 acc = vec3(0.);
  for (int i = 0; i < 24; i++){
    float fi = float(i);
    vec2 o;
    if (sh == 0){ float rr = sqrt((fi + .5) / 24.); float an = fi * 2.39996; o = vec2(cos(an), sin(an)) * rr; }
    else { float t = fi / 23. * 2. - 1.; o = sh == 1 ? vec2(t, 0.) : vec2(0., t); }
    vec2 st = uv + o * r * vec2(1. / aspect(), 1.);
    acc += mix(texture(uA, st).rgb, texture(uB, st).rgb, fade);
  }
  vec3 col = acc / 24. * (1. + p_lift * bump);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-bokeh', name:'Bokeh dissolve', cat:'transition', nonLocal:true, search:['defocus', 'bloom', 'lens blur', 'out of focus'],
  desc:'Both images melt out of focus into bright discs of light, then B pulls back into focus.',
  params:[ R('radius','Disc size',.045,.005,.12), R('gain','Highlight bloom',4,0,10), S('shape','Aperture',['Round','Hexagon'],0) ],
  fs:`vec2 bokeh_hex(vec2 o){
  /* push a disc sample out to the edge of a hexagon at the same angle */
  float an = atan(o.y, o.x);
  float seg = mod(an + PI / 6., PI / 3.) - PI / 6.;
  return o * (cos(PI / 6.) / cos(seg));
}
vec4 fx(vec2 uv){
  float p = uProgress, bump = sin(p * PI);
  float r = p_radius * bump;
  float fade = smoothstep(.35, .65, p);
  bool hex = p_shape > .5;
  vec3 acc = vec3(0.); float wsum = 0.;
  for (int i = 0; i < 24; i++){
    float fi = float(i);
    float rr = sqrt((fi + .5) / 24.); float an = fi * 2.39996;
    vec2 o = vec2(cos(an), sin(an)) * rr;
    if (hex) o = bokeh_hex(o);
    vec2 st = uv + o * r * vec2(1. / aspect(), 1.);
    vec3 c = mix(texture(uA, st).rgb, texture(uB, st).rgb, fade);
    float l = luma(c);
    float w = 1. + p_gain * bump * l * l * l * l * 4.;
    acc += c * w; wsum += w;
  }
  vec3 col = acc / wsum;
  /* the weighting darkens midtones slightly; give back a little of the energy as glow */
  col *= 1. + bump * p_gain * .04;
  return vec4(min(col, 1.), 1.);
}` });

FX.register({ id:'tr-light-rays', name:'Light rays', cat:'transition', nonLocal:true, search:['god rays', 'volumetric', 'streaks', 'shine', 'sapphire'],
  desc:'The bright parts of both images throw rays out from a light point, peaking as A dissolves into B.',
  params:[ R('threshold','Threshold',.45,0,1), R('length','Ray length',.55,0,1), R('amount','Intensity',3.5,0,8), R('x','Light X',0,-1,1), R('y','Light Y',.2,-1,1), C('color','Ray tint','#fff1d8',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, bump = sin(p * PI);
  float fade = smoothstep(.3, .7, p);
  vec2 ctr = vec2(.5 + p_x * .5, .5 + p_y * .5);
  vec3 base = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, fade);
  vec3 acc = vec3(0.);
  float len = p_length * bump;
  for (int i = 0; i < 24; i++){
    float k = float(i) / 23.;
    vec2 st = mix(uv, ctr, k * len);
    vec3 c = mix(texture(uA, st).rgb, texture(uB, st).rgb, fade);
    float l = max(luma(c) - p_threshold, 0.) / max(1. - p_threshold, .05);
    acc += c * l * (1. - k * .7);
  }
  vec3 rays = acc / 24. * p_color * p_amount * bump;
  return vec4(1. - (1. - base) * (1. - min(rays, 1.)), 1.);
}` });

FX.register({ id:'tr-light-leak', name:'Light leak', cat:'transition', search:['film', 'warm glow', 'lens flare', 'flare', 'capcut'],
  desc:'Soft warm light spills across the frame and drifts, peaking over the cut, with a dissolve underneath.',
  params:[ C('color','Leak colour','#ff8a3d',false), C('color2','Second colour','#ff3d6e',false), R('amount','Intensity',.8,0,2.5), S('drift','Drift',['Left to right','Right to left','Upwards','Downwards'],0), R('scale','Size',1.2,.4,4), I('seed','Seed',3,0,99) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress, bump = sin(p * PI);
  int d = int(p_drift + .5);
  vec2 dir = d == 0 ? vec2(1, 0) : d == 1 ? vec2(-1, 0) : d == 2 ? vec2(0, -1) : vec2(0, 1);
  vec2 c = centered(uv) / p_scale;
  vec2 q = c - dir * (p - .5) * 1.1;
  float sd = p_seed * 7.31;
  float n1 = fbm(q * 1.3 + sd);
  float n2 = fbm(q * 2.1 - sd + 4.);
  /* a broad source pushed in from the side the drift starts on, broken up by noise */
  float side = dot(q, -dir) * .9 + .5;
  float leak = smoothstep(.25, 1., n1 * 1.2 + side * .6 - .25);
  float leak2 = smoothstep(.45, .95, n2 + side * .35);
  vec3 light = p_color * leak + p_color2 * leak2 * .8 + vec3(1., .95, .85) * pow(leak, 4.) * .6;
  float e = bump * bump * p_amount;
  vec3 base = mix(a, b, smoothstep(.25, .75, p));
  vec3 col = 1. - (1. - base) * (1. - clamp(light * e, 0., 1.));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-bloom', name:'Bloom dissolve', cat:'transition', nonLocal:true, search:['glow', 'exposure blur', 'glow out', 'dreamy', 'fcp'],
  desc:'Highlights swell into a soft glow and the exposure lifts, carrying A over into B before both settle.',
  params:[ R('threshold','Threshold',.55,0,1), R('radius','Glow size',.06,.005,.15), R('amount','Glow',1.5,0,5), R('stops','Exposure lift',.5,0,3) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, bump = sin(p * PI);
  float fade = smoothstep(.3, .7, p);
  vec3 base = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, fade);
  vec3 acc = vec3(0.);
  float r = p_radius * (.3 + .7 * bump);
  for (int i = 0; i < 24; i++){
    float fi = float(i);
    float rr = sqrt((fi + .5) / 24.); float an = fi * 2.39996;
    vec2 st = uv + vec2(cos(an), sin(an)) * rr * r * vec2(1. / aspect(), 1.);
    vec3 c = mix(texture(uA, st).rgb, texture(uB, st).rgb, fade);
    float l = luma(c);
    acc += c * smoothstep(p_threshold, p_threshold + .25, l) * (1. - rr * .5);
  }
  vec3 glow = acc / 24. * p_amount * 1.6;
  vec3 col = base * exp2(p_stops * bump * bump) + glow * bump * bump;
  col = mix(min(col, 1.), 1. - exp(-col), .5 * bump);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-tint-wash', name:'Tinted wash', cat:'transition', search:['colour wash', 'warm wash', 'burn', 'colour dip'],
  desc:'A colour washes over both images through the dissolve without hiding them, like a gel in front of the lens.',
  params:[ C('color','Wash','#e8663a','accent'), R('amount','Strength',1,0,2), S('mode','Mix',['Add','Screen','Multiply'],0) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float p = uProgress;
  float wa = p * p_amount, wb = (1. - p) * p_amount;
  int m = int(p_mode + .5);
  vec3 ta, tb;
  if (m == 0){ ta = a + p_color * wa; tb = b + p_color * wb; }
  else if (m == 1){ ta = 1. - (1. - a) * (1. - p_color * min(wa, 1.)); tb = 1. - (1. - b) * (1. - p_color * min(wb, 1.)); }
  else { ta = a * mix(vec3(1.), p_color, min(wa, 1.)); tb = b * mix(vec3(1.), p_color, min(wb, 1.)); }
  return vec4(clamp(mix(ta, tb, p), 0., 1.), 1.);
}` });

FX.register({ id:'tr-edge-glow', name:'Edge glow', cat:'transition', search:['neon', 'outline', 'sobel', 'line art', 'edges'],
  desc:'A strips down to glowing outlines on dark, the outlines cross into B’s, and B fills back in behind them.',
  params:[ R('thick','Line weight',1.1,.5,4), R('bright','Glow',1.2,.2,3), R('dark','Darken behind',.85,0,1), S('colour','Line colour',['From the image','Single colour'],0), C('color','Colour','#7af0ff','accent') ],
  fs:`float edgeglow_g(sampler2D s, vec2 uv, vec2 px){
  float tl = luma(texture(s, uv + px * vec2(-1, 1)).rgb), t = luma(texture(s, uv + px * vec2(0, 1)).rgb), tr = luma(texture(s, uv + px * vec2(1, 1)).rgb);
  float l = luma(texture(s, uv + px * vec2(-1, 0)).rgb), r = luma(texture(s, uv + px * vec2(1, 0)).rgb);
  float bl = luma(texture(s, uv + px * vec2(-1, -1)).rgb), bo = luma(texture(s, uv + px * vec2(0, -1)).rgb), br = luma(texture(s, uv + px * vec2(1, -1)).rgb);
  float gx = (tr + 2. * r + br) - (tl + 2. * l + bl);
  float gy = (tl + 2. * t + tr) - (bl + 2. * bo + br);
  return length(vec2(gx, gy));
}
/* a crisp line plus a wider, fainter halo sampled at three times the spacing */
vec3 edgeglow_lines(sampler2D s, vec2 uv, vec2 px, vec3 c){
  float g = smoothstep(.04, .35, edgeglow_g(s, uv, px)) + smoothstep(.06, .6, edgeglow_g(s, uv, px * 3.)) * .35;
  vec3 tint = p_colour > .5 ? p_color : mix(vec3(1.), c / max(max(c.r, max(c.g, c.b)), .2), .75);
  return c * (1. - p_dark) + tint * g * p_bright;
}
vec4 fx(vec2 uv){
  vec2 px = p_thick * uPx / uRes;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 ea = edgeglow_lines(uA, uv, px, a), eb = edgeglow_lines(uB, uv, px, b);
  float p = uProgress;
  vec3 col;
  if (p < .35) col = mix(a, ea, smoothstep(0., .35, p));
  else if (p < .65) col = mix(ea, eb, smoothstep(.35, .65, p));
  else col = mix(eb, b, smoothstep(.65, 1., p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-sheen', name:'Sheen sweep', cat:'transition', search:['shine', 'gloss', 'glint', 'highlight sweep', 'stripe'],
  desc:'A soft band of light glides across at an angle and B is swapped in beneath it as it passes.',
  params:[ R('angle','Angle',30,-180,180,1), R('width','Band width',.28,.05,.8), R('amount','Intensity',.7,0,2), C('color','Sheen','#ffffff','accent'), C('color2','Sheen edge','#8fd0ff','accent2') ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 c = centered(uv);
  float ext = abs(dir.x) * aspect() * .5 + abs(dir.y) * .5;
  float w = p_width;
  float pos = mix(-ext - w, ext + w, uProgress);
  float d = dot(c, dir) - pos;
  float m = 1. - smoothstep(-w * .35, w * .35, d);
  float band = exp(-pow(d / (w * .5), 2.));
  float core = exp(-pow(d / (w * .12), 2.));
  vec3 sheen = mix(p_color2, p_color, clamp(.5 - d / w, 0., 1.)) * band * .55 + p_color * core * .6;
  vec3 col = mix(a, b, m);
  col = 1. - (1. - col) * (1. - clamp(sheen * p_amount, 0., 1.));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-ken-burns', name:'Ken Burns crossfade', cat:'transition', search:['pan and zoom', 'slow zoom', 'documentary', 'drift'],
  desc:'A keeps creeping in as it fades, and B arrives already moving and settles to its full frame.',
  params:[ R('zoom','Zoom',.18,0,.4), S('drift','Drift',['Centre','Left','Right','Up','Down'],1), R('window','Fade length',.45,.1,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, z = p_zoom;
  int d = int(p_drift + .5);
  vec2 dir = d == 0 ? vec2(0) : d == 1 ? vec2(-1, 0) : d == 2 ? vec2(1, 0) : d == 3 ? vec2(0, 1) : vec2(0, -1);
  /* A runs from full frame to zoomed and shifted; B runs from zoomed and shifted back to full frame */
  float sa = 1. + z * p, sb = 1. + z * (1. - p);
  vec2 oa = dir * z * .35 * p, ob = dir * z * .35 * (p - 1.);
  vec2 ua = (uv - .5 - oa) / sa + .5;
  vec2 ub = (uv - .5 - ob) / sb + .5;
  float w = p_window * .5;
  float m = smoothstep(.5 - w, .5 + w, p);
  return vec4(mix(texture(uA, ua).rgb, texture(uB, ub).rgb, m), 1.);
}` });

FX.register({ id:'tr-glow-dissolve', name:'Glow-edge dissolve', cat:'transition', search:['neon', 'emissive', 'rim', 'noise reveal', 'webgl'],
  desc:'B opens through soft noise with a clean glowing rim in two colours at the edge, light rather than burnt.',
  params:[ R('scale','Noise scale',1.8,.5,10), R('width','Rim width',.05,.005,.2), R('glow','Glow',1.4,0,4), C('color','Rim','#7aa8ff','accent'), C('color2','Rim core','#f4f0ff','accent2') ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec2 c = centered(uv) * p_scale;
  /* domain-warped noise so the opening grows in lobes, not blobs */
  vec2 wq = vec2(fbm(c + 1.7), fbm(c + 9.2));
  float n = clamp((fbm(c + wq * .6 + 3.) - .3) / .4, 0., 1.);
  float w = p_width;
  float thr = mix(-w * 2., 1. + w * 2., uProgress);
  float m = 1. - smoothstep(thr - .004, thr + .004, n);
  float d = n - thr;
  float rim = exp(-abs(d) / w * 2.5);
  float core = exp(-abs(d) / w * 10.);
  vec3 col = mix(a, b, m);
  vec3 light = p_color * rim + p_color2 * core;
  float live = step(.001, uProgress) * step(uProgress, .999);
  col += light * p_glow * live * .6;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-spin-flash', name:'Spin flash', cat:'transition', search:['dreamy zoom', 'zoom flash', 'rotate', 'twist'],
  desc:'A zooms in and turns slightly as it brightens to a flash, and B unwinds out of the light.',
  params:[ R('rotation','Turn',8,0,45,1), R('scale','Zoom',1.25,1,2), R('flash','Flash',1,0,1), C('color','Flash colour','#ffffff',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float ph = p < .5 ? p * 2. : (1. - p) * 2.;
  float e = ph * ph * (3. - 2. * ph);
  vec2 c = centered(uv);
  float ang = radians(p_rotation) * e * (p < .5 ? 1. : -1.);
  c = rot(ang) * c / mix(1., p_scale, e);
  vec2 st = uncentered(c);
  vec3 col = p < .5 ? texture(uA, st).rgb : texture(uB, st).rgb;
  float f = pow(e, 3.) * p_flash;
  col = mix(col + col * f, p_color, smoothstep(.55, 1., f));
  return vec4(clamp(col, 0., 1.), 1.);
}` });
