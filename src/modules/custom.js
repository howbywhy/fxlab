/* =====================================================================
   YOUR MODULES
   Paste new FX.register({...}) blocks here. They appear in the library
   under the category you give them. Example (remove the comment marks):

   FX.register({ id:'fx-my-tint', name:'My tint', cat:'fx',
     desc:'Tints the frame toward a colour.',
     params:[ R('amount','Amount',.5,0,1), C('color','Colour','#ff5a36') ],
     fs:`vec4 fx(vec2 uv){
       vec3 c = texture(uInput, uv).rgb;
       return vec4(mix(c, c * p_color, p_amount), 1.);
     }` });
   ===================================================================== */

