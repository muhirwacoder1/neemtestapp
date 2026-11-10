import { PREVIEW_POS, PRESSURE_COLORS } from "./pressure";

// The native shader and web canvas use the same anatomical lobes and palette.
const paletteCode = PRESSURE_COLORS.map((hex, i) => {
  const rgb = [1, 3, 5].map((start) =>
    (parseInt(hex.slice(start, start + 2), 16) / 255).toFixed(6),
  );
  return `float3 c${i}=float3(${rgb.join(",")});`;
}).join("");
const previewWeights = PREVIEW_POS.map(
  (p, i) =>
    `v=gait[${i}]*weight(p,float2(${p.x}.,${p.y}.),float2(${p.sx}.,${p.sy}.));sum+=v;peak=max(peak,v);`,
).join("");
export const PRESSURE_SHADER = `
 uniform float4 amplitude; uniform float gait[14]; uniform float preview;
 float3 palette(float t){${paletteCode}float x=clamp(t,0.,1.)*5.;if(x<1.)return mix(c0,c1,x);if(x<2.)return mix(c1,c2,x-1.);if(x<3.)return mix(c2,c3,x-2.);if(x<4.)return mix(c3,c4,x-3.);return mix(c4,c5,x-4.);}
 float weight(float2 p,float2 c,float2 s){float2 v=(p-c)/s;return exp(-.5*dot(v,v));}
 half4 main(float2 p){
   if(preview>.5){float v=0.;float sum=0.;float peak=0.;${previewWeights}return half4(palette(max(.02,peak+.075*(sum-peak))),1.);}
   float4 w=float4(weight(p,float2(59,227),float2(27,31)),weight(p,float2(59,164),float2(25,34)),weight(p,float2(56,104),float2(36,31)),weight(p,float2(45,47),float2(35,29)));
   float sum=0.;float coverage=0.;for(int i=0;i<4;i++){if(amplitude[i]>=0.){sum+=amplitude[i]*w[i];coverage=max(coverage,w[i]);}}
   if(coverage<.35)return half4(.85,.90,.93,.3);return half4(palette(sum),1.);
 }
`;
