import type {CameraCut,CameraSnapshot,CameraLesson} from '@vibestage/core';
const number=(n:number,digits=1)=>Number(n.toFixed(digits)).toString();
export function CameraPanel({info,cuts,lesson,readOnly,onSeek,disabled}:{info:CameraSnapshot|null;cuts?:CameraCut[];lesson?:CameraLesson;readOnly?:boolean;onSeek:(t:number)=>void;disabled:boolean}){
  if(!info)return null;
  return <section className="camera-metadata" aria-label="摄影机参数">
    {lesson&&<section className="camera-lesson" aria-label="镜头学习提示"><h3>{info.label}</h3><p>{lesson.purpose}</p><p><strong>观察重点</strong>{lesson.observe}</p><details><summary>{readOnly?'复制后动手练习':'动手练习'}</summary><p>{lesson.tryThis}</p></details></section>}
    {readOnly&&info.preset?.warnings.map(w=><p className="preset-warning" key={w}>{w}</p>)}
    {info.shot&&<p className="active-shot"><span>当前分镜</span><strong>{info.shot.label||info.shot.id}</strong><small>{number(info.shot.start,2)}–{number(info.shot.end,2)} s · {info.label}</small></p>}
    {info.performance&&<p className="lens-note">{info.performance.mode==='independent'?'独立表演':'延续表演'} · 动作时间 {number(info.performance.sourceTimeSeconds,2)} s</p>}
    <dl className="lens-data">
      <div><dt>焦距</dt><dd>{info.focalLengthMm!==undefined?`${number(info.focalLengthMm,2)} mm`:info.lensMode==='legacy-fov'?'未配置 · FOV 驱动':'不适用'}</dd></div>
      <div><dt>光圈</dt><dd>{info.aperture!==undefined?`f/${number(info.aperture)}`:'未配置'}</dd></div>
      <div><dt>传感器</dt><dd>{info.sensor?`${number(info.sensor.widthMm)} × ${number(info.sensor.heightMm)} mm`:'未配置'}</dd></div>
      {info.activeSensor&&<div><dt>有效画幅</dt><dd>{number(info.activeSensor.widthMm,2)} × {number(info.activeSensor.heightMm,2)} mm</dd></div>}
      {info.verticalFovDegrees!==undefined&&<div><dt>视场角 · 水平 / 垂直</dt><dd>{number(info.horizontalFovDegrees!)}° / {number(info.verticalFovDegrees)}°</dd></div>}
      <div><dt>对焦距离 · 光轴</dt><dd>{info.focus?`${number(info.focus.planeDistanceMeters??info.focus.distanceMeters,2)} m`:'未配置'}</dd></div>
      {info.focus?.mode==='target'&&<div className="lens-text"><dt>对焦目标</dt><dd>{info.focus.targetName}</dd></div>}
      <div className="lens-text"><dt>景别</dt><dd>{info.shotSize||'未配置'}</dd></div>
      <div className="lens-text"><dt>运动</dt><dd>{info.movement||'未配置'}</dd></div>
    </dl>
    <p className="lens-note">{info.depthOfFieldEnabled?'景深已启用 · 光圈和对焦实时生效':'景深未启用 · 透视机位需有效光圈与前方对焦距离'}</p>
    {!!cuts?.length&&<details className="cut-list"><summary>分镜计划 · {cuts.length} 段</summary>{cuts.map(c=><button key={c.id} disabled={disabled} className={info.shot?.id===c.id?'active':''} onClick={()=>onSeek(c.start)} aria-label={`跳至${c.label||c.id}`}><span>{c.label||c.id}</span><small>{number(c.start,2)}–{number(c.end,2)} s</small></button>)}</details>}
  </section>;
}
