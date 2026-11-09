import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';

/** Fullscreen the viewport wrapper so its DOM HUD stays with the WebGL canvas. */
export function useViewportFullscreen(target:RefObject<HTMLDivElement|null>,onTransition:()=>void){
  const [native,setNative]=useState(false),[expanded,setExpanded]=useState(false),[pending,setPending]=useState(false);
  const transition=useRef(onTransition);transition.current=onTransition;
  const inFlight=useRef(false),mounted=useRef(true);
  useEffect(()=>{
    mounted.current=true;
    const sync=()=>{setNative(document.fullscreenElement===target.current);transition.current();};
    document.addEventListener('fullscreenchange',sync);
    return()=>{mounted.current=false;document.removeEventListener('fullscreenchange',sync);};
  },[target]);
  const active=native||expanded;
  useEffect(()=>{
    if(!active)return;
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();transition.current();if(document.fullscreenElement===target.current)void document.exitFullscreen().catch(()=>{});setExpanded(false);}};
    window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);
  },[active,target]);
  useEffect(()=>{
    if(!active)return;
    const old=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
    const background=new Map<HTMLElement,boolean>();let branch:HTMLElement|null=target.current;
    while(branch?.parentElement){for(const sibling of branch.parentElement.children){if(sibling!==branch&&sibling instanceof HTMLElement){background.set(sibling,sibling.inert);sibling.inert=true;}}if(branch.parentElement===document.body)break;branch=branch.parentElement;}
    target.current?.querySelector('canvas')?.focus({preventScroll:true});
    return()=>{document.documentElement.style.overflow=old;for(const [element,inert] of background)element.inert=inert;};
  },[active,target]);
  const toggle=useCallback(async()=>{
    if(inFlight.current||!target.current)return;
    inFlight.current=true;setPending(true);transition.current();
    try{
      if(document.fullscreenElement===target.current)await document.exitFullscreen();
      else if(expanded)setExpanded(false);
      else{
        // Mobile browsers and embedded previews may not allow native fullscreen.
        try{if(!document.fullscreenEnabled||!target.current.requestFullscreen)throw new Error('unsupported');await target.current.requestFullscreen();}
        catch{if(mounted.current)setExpanded(true);}
      }
    }finally{inFlight.current=false;if(mounted.current)setPending(false);}
  },[target,expanded]);
  return {active,pending,toggle};
}
