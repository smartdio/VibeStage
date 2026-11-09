import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import type {CameraSnapshot} from '@vibestage/core';

/** One deterministic optical pipeline for the viewfinder, monitor and exported frames. */
export class ShotRenderer {
  private target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthTexture:new T.DepthTexture(1,1,T.UnsignedIntType),samples:4});
  private material=new T.ShaderMaterial({
    depthTest:false,depthWrite:false,
    uniforms:{color:{value:null},depth:{value:null},cameraNear:{value:.1},cameraFar:{value:500},focus:{value:5},radiusScale:{value:0},maxRadius:{value:.03},aspect:{value:1},pixelHeight:{value:720}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`
      #include <packing>
      uniform sampler2D color,depth;
      uniform float cameraNear,cameraFar,focus,radiusScale,maxRadius,aspect,pixelHeight;
      varying vec2 vUv;
      float distanceAt(vec2 uv){return -perspectiveDepthToViewZ(texture2D(depth,uv).x,cameraNear,cameraFar);}
      float coc(float z){return clamp(radiusScale*(1.-focus/z),-maxRadius,maxRadius);}
      void main(){
        float z=distanceAt(vUv),centerCoc=coc(z),radius=abs(centerCoc);
        vec4 sum=texture2D(color,vUv);float weight=1.;
        if(radius*pixelHeight>.35){
          // Fixed disk taps: no temporal noise or different export sampling.
          for(int i=0;i<64;i++){
            float fi=float(i)+.5;
            float r=sqrt(fi/64.);
            float theta=fi*2.39996323;
            vec2 uv=clamp(vUv+vec2(cos(theta)/aspect,sin(theta))*r*radius,vec2(0.),vec2(1.));
            float sampleZ=distanceAt(uv),sampleCoc=coc(sampleZ);
            // Do not drag a sharp foreground silhouette across a blurred background.
            float w=sampleZ<z? smoothstep(0.,max(radius*r,1./pixelHeight),abs(sampleCoc)):1.;
            sum+=texture2D(color,uv)*w;weight+=w;
          }
        }
        gl_FragColor=sum/weight;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  private quad=new FullScreenQuad(this.material);
  render(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,info:CameraSnapshot,width:number,height:number){
    const settings=info.depthOfField;
    if(!settings){renderer.render(scene,camera);return;}
    const previousTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest();
    const autoClear=renderer.autoClear;
    // Render the same optical image size for the same output, independent of screen/DPR.
    this.target.setSize(width,height);
    try{
      renderer.setRenderTarget(this.target);renderer.setScissorTest(false);renderer.autoClear=true;renderer.render(scene,camera);
      const u=this.material.uniforms;
      u.color.value=this.target.texture;u.depth.value=this.target.depthTexture;
      u.cameraNear.value=info.near;u.cameraFar.value=info.far;u.focus.value=settings.focusPlaneMeters;
      u.radiusScale.value=settings.radiusScale;u.maxRadius.value=settings.maxRadiusFraction;u.aspect.value=info.outputAspect;u.pixelHeight.value=height;
      renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
      this.quad.render(renderer);
    }finally{renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=autoClear;}
  }
  dispose(){this.target.dispose();this.quad.dispose();this.material.dispose();}
}
