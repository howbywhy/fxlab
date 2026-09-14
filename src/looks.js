/* ---------------- Starter looks ----------------
   Compositions that teach how primitives combine. Apply one, tweak it,
   save it as your own look.
   Format: { id, name, desc, data:{ base, stack, timeline, sources? } }.
   Optional sources.A.process / sources.B.process are Prepare lists
   (treatments + fx-reframe). Missing process means []. A Look owns
   preparation the same way it owns the stack — applying one cannot
   leave the previous Look's lanes behind. Most starters omit sources.

   Each look is a transferable move, not a campaign template. Grain is never
   used as a decorative last layer. s-knockout keeps its original stack so
   the look-knockout composition golden stays meaningful.
------------------------------------------------- */
const STARTER_LOOKS = (() => {
  const m = (id, params = {}) => ({ id, params });
  const once = (duration = 4, hold = .2) => ({ duration, loopMode:'once', easing:'Brand', hold });
  const loop = (duration = 4, hold = .15) => ({ duration, loopMode:'pingpong', easing:'Brand', hold });
  return [
    /* A + B → type is the mix → print */
    { id:'s-pattern', name:'Two-source', desc:'B shows through live type over A, then a press finish. The mix is the type.',
      search:['combine', 'print', 'window'],
      data:{ base:m('mx-type', { text:'AND', size:42, tracking:-.04 }),
        stack:[ m('trt-press', { misreg:2.4, spread:1.4 }),
                m('ovl-frame', { inset:.07, width:2, style:0 }) ],
        timeline:loop(5) } },

    /* generator → type window */
    { id:'s-opart', name:'Op window', desc:'A generated field becomes the picture; type knocks a window through it.',
      data:{ base:m('gen-stripes'),
        stack:[ m('kt-knockout', { mode:0, blockShape:2, block:.75 }) ],
        timeline:loop(6) } },

    /* processed frame → matte back to raw source */
    { id:'s-flowfield', name:'Hold-out', desc:'Kaleido the frame, then punch raw source B back through a luma matte.',
      search:['combine', 'window'],
      data:{ base:m('src-a'),
        stack:[ m('fx-kaleido', { segments:8, spin:1, zoom:1.15 }),
                m('fx-matte', { replace:1, mode:1, from:0, threshold:.42, soft:.08, amount:1 }) ],
        timeline:loop(6) } },

    /* transition → spatial → type */
    { id:'s-liquid', name:'Through', desc:'A torn wipe is wrapped into polar space, then type sits on the result.',
      search:['distort'],
      data:{ base:m('tr-wipe', { angle:90, soft:.04, edge:2, edgeAmount:.7, line:.012 }),
        stack:[ m('fx-polar', { mode:0, spin:1, zoom:1.05 }),
                m('kt-fit', { ground:0, motion:4, text:'IN\nTHE\nROUND', alternate:true, margin:.1 }) ],
        timeline:loop(7, .1) } },

    /* image → grade → type in the world */
    { id:'s-tape', name:'Tape', desc:'Grade the photograph, then run type through it as tape — not on a separate card.',
      data:{ base:m('src-a'),
        stack:[ m('trt-duotone'),
                m('kt-tape', { ground:0, edge:2 }) ],
        timeline:loop(5) } },

    /* reveal / build on imagery */
    { id:'s-headline', name:'Reveal', desc:'Letters slant in over the live frame, with a logo as a sign-off, not the subject.',
      data:{ base:m('src-a'),
        stack:[ m('kt-reveal', { ground:0, style:5, unit:0, stagger:.45, text:'ON\nTHE\nIMAGE' }),
                m('lg-logo', { size:16, y:-.84, entry:1, motion:0 }) ],
        timeline:once(4) } },

    /* window / knockout — stack unchanged: look-knockout golden */
    { id:'s-knockout', name:'Type window', desc:'Type cut out of a colour block so the picture shows through the letters.',
      data:{ base:m('src-a'),
        stack:[ m('kt-knockout', { mode:0 }) ],
        timeline:loop(6) } },

    /* logo as form on a generated field */
    { id:'s-ripple', name:'Logo field', desc:'A generated mesh, then the logo as expanding silhouettes — the mark is the drawing.',
      search:['repeat'],
      data:{ base:m('gen-mesh'),
        stack:[ m('lg-ripple', { ground:0, size:22, count:6 }) ],
        timeline:loop(6) } },

    /* reveal / build over a generated ground */
    { id:'s-sting', name:'Logo build', desc:'A colour field first, then the logo builds itself on top of it.',
      search:['reveal'],
      data:{ base:m('gen-field', { mode:2, glow:.45 }),
        stack:[ m('lg-sting', { style:0, size:56, ground:0, stagger:.7, pieces:12 }) ],
        timeline:once(5, .12) } },

    /* redraw + material */
    { id:'s-hatched', name:'Hatch', desc:'Redraw the photograph as engraving, then lay a paper surface over it.',
      search:['print', 'texture'],
      data:{ base:m('src-a'),
        stack:[ m('trt-hatch'), m('trt-surface', { kind:0, amount:.35 }) ],
        timeline:once(4) } },

    /* type + print finish */
    { id:'s-cutup', name:'Cut-up', desc:'Collage lettering on scraps, then a press finish so the type feels printed.',
      data:{ base:m('src-a'),
        stack:[ m('kt-collage'), m('trt-press', { misreg:1.2 }) ],
        timeline:once(5) } },

    /* spatial type + logo */
    { id:'s-ring', name:'Type ring', desc:'Wrap a line of type into a ring over the frame, logo held in the centre.',
      data:{ base:m('src-a'),
        stack:[ m('kt-warp', { mode:8, text:'AROUND THE FRAME • AROUND THE FRAME •', drive:0, amount:.2, ground:0 }),
                m('lg-logo', { size:22, entry:0, motion:0 }) ],
        timeline:loop(8) } },

    /* feedback → framing */
    { id:'s-solid', name:'Echo', desc:'Feedback trails accumulate, then a frame holds the result like a still.',
      data:{ base:m('src-a'),
        stack:[ m('fx-echo', { zoom:1.045, rotate:.8, decay:.92 }),
                m('ovl-frame', { inset:.06, width:2.5, style:0 }) ],
        timeline:loop(6) } },

    /* scan / accumulate */
    { id:'s-scan', name:'Scan', desc:'A slit-scan time smear, then cinema bars so the trail reads as a shot.',
      data:{ base:m('src-a'),
        stack:[ m('fx-slitscan'),
                m('ovl-letterbox', { amount:.1, animate:false, color:'#000000' }) ],
        timeline:loop(6) } },

    /* repeat + overlay that changes the composition */
    { id:'s-kaleido', name:'Repeat', desc:'Tile the photograph into a scrolling grid, then registration marks on top.',
      data:{ base:m('src-a'),
        stack:[ m('fx-tile', { mode:3, tiles:3, scroll:1, mirror:true }),
                m('ovl-grid', { mode:1, cols:6, rows:8, opacity:.45 }) ],
        timeline:loop(6) } },

    /* PREPARE A → PREPARE B → COMBINE — authored sources meet through a transition */
    { id:'s-cut', name:'Prepared Cut', desc:'Grade one source, print the other, then let them meet through the existing tile flip.',
      search:['combine', 'transition', 'prepared'],
      data:{
        sources:{
          A:{ process:[ m('trt-splittone', {
            saturation:.12, contrast:1.28, exposure:.04,
            shadowAmt:1.05, midAmt:.35, highAmt:.9, balance:-.06,
          }) ] },
          B:{ process:[ m('trt-riso', { offset:3.2, density:1.2, grain:.62, gsize:1.7 }) ] },
        },
        base:m('tr-tiles', { tiles:5, pattern:0, mode:0, stagger:.6 }),
        stack:[ m('ovl-letterbox', { amount:.07, animate:false }) ],
        timeline:{ duration:5, loopMode:'once', easing:'Linear', hold:.05 },
      } },

    /* PREPARE A → PREPARE B → COMBINE — same grammar, held mix, not a transition */
    { id:'s-states', name:'Two States', desc:'Crop and duotone A, screen B, then hold both in one mix.',
      search:['combine', 'mix', 'prepared'],
      data:{
        sources:{
          A:{ process:[
            m('fx-reframe', { scale:2.35, x:.3, y:.48 }),
            m('trt-duotone', { contrast:1.35, amount:1 }),
          ] },
          B:{ process:[ m('trt-halftone', { cell:12, cmyk:false }) ] },
        },
        base:m('mx-gradient', { type:0, angle:108, position:.5, soft:.1, animate:false, edge:0, dither:.15 }),
        stack:[],
        timeline:once(4, .22),
      } },
  ];
})();

/* Internal fixtures only. Not listed in the Library or System starters. */
const TEST_LOOKS = [
  { id:'t-prepare-tiles', name:'Prepare tiles', desc:'Prepared A and B meeting through tile flip.',
    data:{
      base:{ id:'tr-tiles', params:{ tiles:5, pattern:0, mode:0, stagger:.55 } },
      stack:[{ id:'ovl-letterbox', params:{ amount:.1, animate:false } }],
      timeline:{ duration:4, loopMode:'once', easing:'Linear', hold:0 },
      sources:{
        A:{ process:[{ id:'trt-splittone', params:{
          shadow:'#0a1c4a', mid:'#2a5080', high:'#c8e8ff',
          shadowAmt:1.2, midAmt:.8, highAmt:1.1, saturation:.05, contrast:1.4, exposure:.05,
        } }] },
        B:{ process:[{ id:'trt-riso', params:{
          ink1:'#ff2d6a', ink2:'#ffe14a', paper:'#fff6d8',
          offset:8, density:1.4, grain:.85, gsize:2,
        } }] },
      },
    } },
];
