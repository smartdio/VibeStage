import type {CameraSnapshot} from './cameras';
import type {CameraBinding} from './camera-presets';
import {presetDefinition,cameraPresetProgress} from './camera-presets';
import type {DeliveryShot} from './delivery';
const n=(value:number)=>Number(value.toFixed(6));
const binding=(value:CameraBinding)=>`${value.subject}${value.anchor?` / ${value.anchor}`:''}${value.offset?`（锚点局部偏移 ${value.offset.join(', ')} 米）`:''}`;
/** Describe the implemented motion, not a cinematic stereotype inferred from its name. */
export function describeCameraMotion(camera:CameraSnapshot,shot:DeliveryShot,still=false):string {
  if(still)return '只冻结首帧摄影机的位置、朝向与构图。手持或其他运镜是视频中的时间变化，不把抖动轨迹、重影或运动模糊画进这一张图。';
  const record=camera.preset;
  if(!record)return `摄影机运动：${camera.movement||'未提供可解析的运动预设；遵循摄影与运镜设计要求、动作节点及 reference.mp4，不从单帧推断固定机位或手持抖动。'}`;
  const c=record.config,p=c.parameters,id=c.presetId;
  const activeStart=p.startSeconds+p.holdStartSeconds,activeEnd=p.endSeconds-p.holdEndSeconds;
  const localStart=Math.max(shot.start,activeStart)-shot.start,localEnd=Math.min(shot.end,activeEnd)-shot.start;
  const timing=localEnd>localStart?`本镜头内 ${n(localStart)}–${n(localEnd)} 秒执行运动段；此范围外锁定路径或抖动相位，但主体跟随与观看目标仍可继续变化。`:'本镜头未与预设运动段相交，路径或抖动相位保持边界值；主体跟随与观看目标仍可继续变化。';
  const common=[`实际运镜预设：${presetDefinition(id).name}。主体绑定：${binding(c.subject)}。`,
    `预设使用成片绝对时间 ${n(p.startSeconds)}–${n(p.endSeconds)} 秒，起始停留 ${n(p.holdStartSeconds)} 秒、结束停留 ${n(p.holdEndSeconds)} 秒；切入本镜头不会重新启动运动。`,id==='handoff-oner'?'交接视线和主体跟随按交接绝对时间执行，不因常规首尾停留而暂停；如另设路径，路径进度单独遵循运动段。':timing];
  if(id==='handheld'){
    const meters=p.shakeMeters??.015,degrees=p.shakeDegrees??.35,hz=p.shakeFrequencyHz??1.4;
    common.push(`基础动作：随主体锚点平移，保持名义距离 ${n(p.distance)} 米、相对锚点高度 ${n(p.height)} 米、侧向偏移 ${n(p.sideOffset)} 米。${p.frame==='subject'?'基础方位跟随主体的水平朝向。':'基础方位按世界坐标保持，不随主体转身旋转。'}该预设本身没有额外推进、拉远或步伐冲击。`,
      meters===0?'位置抖动关闭。':`在基础机位上叠加三个不同相位的连续位移扰动：世界 X 轴东西摆动、Y 轴上下浮动、Z 轴南北浮动。每轴偏离基础位置的幅度上限为 ±${n(meters)} 米（±${n(meters*100)} 厘米），这是单轴包络上限，不是整机合位移或峰峰值。`,
      `视线先从偏移后的机位重新朝向 ${binding(c.lookTarget??c.subject)}，再叠加局部角度扰动。`,
      degrees===0?'额外角度抖动关闭；位置微移引起的重新瞄准仍可能改变视角。':`局部俯仰、水平偏航、光轴横滚分别以不同相位变化，每个附加欧拉角的幅度上限为 ±${n(degrees)}°，按 YXZ 顺序组合；这是附加旋转，不是包含跟随与重新瞄准在内的总转角。`,
      meters===0&&degrees===0?'所有附加手持抖动关闭，仅保留基础跟随。':`抖动由两层连续正弦叠加：基频 ${n(hz)} Hz、权重 65%；较快层 ${n(hz*1.73)} Hz（基频的 1.73 倍）、权重 35%。各轴使用不同但固定的相位，呈连续的主摆动叠加较快细颤，避免所有方向同步摆动、机械钟摆感和逐帧随机跳变。不是按脚步触发的震动，也不是后期二维画面震屏。`,
      `复现种子为 ${p.seed??7}，决定相位；外部生成模型不保证按种子精确复现，应以白模视频的节奏和幅度为准。`,
      '停留段锁住已有抖动偏移，不自动归零；运动段边界没有额外振幅淡入淡出，不额外添加突发冲击、甩镜或焦距抽动。',
      `对焦目标为 ${binding(c.focusTarget??c.subject)}；与观看目标独立。保持主体可辨识和原有构图意图，允许手持导致的自然画面漂移，幅度由实际参数决定，不强行添加自动回中或防抖锁定。`);
  }else{
    const detailed=describeStandardMotion(camera,shot);
    if(detailed){common.length=1;common.push(detailed);}
    const motions:Partial<Record<typeof id,string>>={
      'push-in':`沿基础方位向主体推进 ${n(p.travel)} 米，保持预设焦距。`,'pull-out':`沿基础方位远离主体 ${n(p.travel)} 米，保持预设焦距。`,
      'pan':`水平摇镜，从基础水平角偏移 ${n(-p.angleDegrees/2)}° 转至偏移 ${n(p.angleDegrees/2)}°。`,
      'tilt':`上下摇镜，俯仰偏移从 ${n(-p.angleDegrees/2)}° 到 ${n(p.angleDegrees/2)}°，极端俯仰受限以避免翻转。`,
      'whip-pan':`在设定运动段内快速水平转向 ${n(p.angleDegrees)}°；不自行假定固定时长或已模拟运动模糊。`,
      'rear-follow':'从主体后方跟随平移。','lead-follow':'位于主体前方引导跟拍，朝向主体。','side-follow':'从主体侧面跟随平移。','pov':'跟随主体眼位式位置，默认向主体前方观看。',
      'arc':`绕基准点转过 ${n(p.angleDegrees)}°。`,'orbit-360':`绕基准点完整环绕 ${p.angleDegrees<0?-360:360}°。`,
      'reveal-slide':`横向移动，偏移从 ${n(-p.travel/2)} 米到 ${n(p.travel/2)} 米，经前景遮挡揭示主体。`,
      'pedestal':`垂直移动 ${n(p.travel)} 米；${p.lockOrientation?'保持起始朝向':'继续朝向观看点'}。`,
      'crane-up':`升高 ${n(p.rise??3)} 米并向外移动 ${n(p.travel)} 米。`,'crane-down':`从高出 ${n(p.rise??3)} 米、向外偏移 ${n(p.travel)} 米的位置回落至基础机位。`,
      'zoom':`机位路线不额外移动，焦距从 ${n(p.focalLengthMm)} mm 平滑变至 ${n(p.endFocalLengthMm??70)} mm。`,'snap-zoom':`在设定运动段内快速变焦，从 ${n(p.focalLengthMm)} mm 到 ${n(p.endFocalLengthMm??70)} mm。`,
      'dolly-zoom':`沿起始光轴移动 ${n(p.travel)} 米，同时按主体光轴深度补偿焦距，使主体平面大小近似保持。`,
      'rack-focus':`保持基础构图，按焦平面倒数从 ${binding(c.subject)} 向 ${c.secondary?binding(c.secondary):'第二主体'} 平滑拉焦。`,
      'subject-mounted':'机位绑定主体锚点的完整世界姿态，继承平移和旋转。',
      'flythrough':'沿世界坐标路径穿行；默认沿路径切线观看，使用连续传输的朝向框架避免突然翻转。',
      'handoff-oner':`从 ${binding(c.subject)} 连续交接至 ${c.secondary?binding(c.secondary):'第二主体'}，交接后拉远 ${n(p.travel)} 米；交接使用成片 ${n(p.handoffStartSeconds??(p.startSeconds+(p.endSeconds-p.startSeconds)*.35))}–${n(p.handoffEndSeconds??(p.startSeconds+(p.endSeconds-p.startSeconds)*.65))} 秒。`,
      'dutch-angle':`基础构图附加固定光轴横滚 ${n(p.rollDegrees??0)}°。`,
    };
    if(!detailed)common.push(motions[id]??'保持此预设的基础构图，不额外添加未配置的抖动或移动。',
      `路径进度采用${p.easing==='linear'?'匀速':'五次平滑起停'}；${id==='subject-mounted'?'主体绑定使用完整世界姿态，忽略 frame。':c.path&&['flythrough','handoff-oner'].includes(id)?'显式路径使用世界坐标，不随主体移动。':p.frame==='subject'?'基础构图会跟随主体位置与水平朝向。':'使用世界参考方位；跟拍类仍跟随主体平移。'}`);
    if(c.path&&['flythrough','handoff-oner'].includes(id))common.push(`路径按世界坐标控制点顺序 ${c.path.points.map(v=>`(${v.join(', ')})`).join(' → ')} 米进行曲线与弧长采样；前视距离 ${n(c.path.lookAheadMeters)} 米。`);
    if(!detailed&&c.lookTarget)common.push(`独立观看目标：${binding(c.lookTarget)}。`);
    if(!detailed&&c.focusTarget)common.push(`独立对焦目标：${binding(c.focusTarget)}。`);
  }
  if(record.warnings.length)common.push(`白模采样警告：${record.warnings.join('；')}。不要把这些问题描述成已自动修正。`);
  return common.join('\n');
}


/** Relative motion is evaluated with the same progress function as the runtime. */
function describeStandardMotion(camera:CameraSnapshot,shot:DeliveryShot):string|undefined {
  const c=camera.preset!.config,p=c.parameters,id=c.presetId;
  if(!['push-in','pull-out','pan','tilt','whip-pan','rear-follow','lead-follow','side-follow','arc','orbit-360','zoom','snap-zoom','dolly-zoom','rack-focus'].includes(id))return;
  const follow=['rear-follow','lead-follow','side-follow'].includes(id);
  const start=p.startSeconds+p.holdStartSeconds,end=p.endSeconds-p.holdEndSeconds;
  const s0=cameraPresetProgress(p,shot.start),s1=cameraPresetProgress(p,shot.end);
  const progress=[0,.25,.5,.75,1].map(f=>{const t=shot.start+(shot.end-shot.start)*f;return `镜头内 ${n(t-shot.start)} 秒：进度 ${n(100*cameraPresetProgress(p,t))}%`;}).join('；');
  const base=follow||p.frame==='subject'?`基准点每帧取主体 ${binding(c.subject)} 的当前锚点位置`:`基准点固定为创建预设时的世界参考点 (${c.reference.target.join(', ')}) 米`;
  const frame=`${base}；基础方位角 ${n(p.headingDegrees)}°，${p.frame==='subject'?'叠加主体当前水平朝向（主体接近竖直时按求值器的水平投影处理）':'不叠加主体转向'}。方位 0° 的外向为世界 +Z、右向为 +X；主体框架下二者随主体水平朝向转动。`;
  const parts=[frame];
  if(follow){
    parts.push('跟拍直接读取每帧主体位置与朝向，不使用路径进度驱动；预设起止时间和首尾停留不会停止跟随，也不会让主体停住。没有额外追赶延迟、速度平滑、步伐颠簸或自动避障。');
    const offsets=id==='rear-follow'?`外向 ${n(p.distance)} 米、右向 ${n(p.sideOffset)} 米`:id==='lead-follow'?`外向 ${n(-p.distance)} 米、右向 ${n(p.sideOffset)} 米`:`右向 ${n(p.distance)} 米、外向 ${n(p.sideOffset)} 米`;
    parts.push(`每帧将机位置于主体锚点加上${offsets}，世界 Y 方向再加 ${n(p.height)} 米。这些是偏移分量，不是摄影机到人物的总直线距离。后方／前方／侧方是预设的名义位置，改变基础方位角会改变实际站位。`,
      p.frame==='subject'?'主体平移时同步平移，主体水平转身时偏移方向也同步旋转，因此可以形成绕人物转动的轨迹。':'主体平移时同步平移；主体转身不会旋转机位偏移，机位保持世界方向的相对位置。',
      '镜头从当前主体状态开始跟随，到本镜头结束仍跟随；如果主体本身静止，机位不会凭空前进。');
  }else{
    const intersectionStart=Math.max(shot.start,start),intersectionEnd=Math.min(shot.end,end);
    parts.push(`预设成片时间 ${n(p.startSeconds)}–${n(p.endSeconds)} 秒；运动段 ${n(start)}–${n(end)} 秒，起始停留 ${n(p.holdStartSeconds)} 秒、结束停留 ${n(p.holdEndSeconds)} 秒。`,
      intersectionEnd>intersectionStart?`本镜头内 ${n(intersectionStart-shot.start)}–${n(intersectionEnd-shot.start)} 秒与运动段相交。`:'本镜头没有与运动段相交，进度保持边界值。',
      `切入本镜头时继承进度 ${n(s0*100)}%，到镜头结束边界为 ${n(s1*100)}%，不会重启整段动作。${progress}。末项是结束边界的理论状态，实际最后输出帧略早。`,
      p.easing==='linear'?'运动段内参数进度匀速；停留边界直接开始或停止，没有额外缓入缓出。':'运动段使用五次平滑进度 6u⁵−15u⁴+10u³：从零速度起动，中段较快，末端降至零速度；不会超调或回弹。',
      '进度在运动段外锁为 0 或 1；这只冻结预设的附加动作。主体框架的基准运动、独立观看目标以及动态对焦仍可变化，不能把所有停留描述成世界机位完全静止。');
    const sample=(value:(s:number)=>number,unit:string)=>`本镜头内起始 ${n(value(s0))}${unit} → 结束边界 ${n(value(s1))}${unit}`;
    if(id==='push-in'||id==='pull-out'){
      const delta=(id==='push-in'?-1:1)*p.travel;
      parts.push(`机位沿基础外向轴移动，外向坐标由 ${n(p.distance)} 米变为 ${n(p.distance+delta)} 米；${sample(s=>p.distance+delta*s,' 米')}。右向偏移保持 ${n(p.sideOffset)} 米，高度偏移保持 ${n(p.height)} 米。`,
        delta===0?'位移量为零，没有附加推进或拉远。':delta<0?`朝基础点方向移动 ${n(-delta)} 米；这是沿基础方位轴的位移，不保证沿当前观看光轴。`:`沿基础外向远离基准点 ${n(delta)} 米；这是实际方向，即使预设名称写作推进也不反转其含义。`,
        `预设焦距保持 ${n(p.focalLengthMm)} mm，变化来自物理机位位移，不加入额外变焦。侧偏或独立观看目标存在时，重新瞄准也会改变朝向。`);
    }
    if(['pan','tilt','whip-pan'].includes(id)){
      const axis=id==='tilt'?'俯仰 X':'水平 Y';
      parts.push(`不增加机位平移。每帧先朝向观看目标形成基础朝向，再按 YXZ 欧拉角在${axis}轴叠加 ${n(p.angleDegrees)} × (进度 − 0.5) 度；完整偏移范围 ${n(-p.angleDegrees/2)}° → ${n(p.angleDegrees/2)}°，${sample(s=>p.angleDegrees*(s-.5),'°')}。正负号决定角度增减，零角度没有附加摇镜。`,
        id==='tilt'?`最终俯仰限制在 ±${n((Math.PI/2-.001)*180/Math.PI)}°，接近限位时不能继续按标称总角度翻转。`:'改变的是水平角，不是横滚；保留基础俯仰。独立目标移动时，基础瞄准角也随之变化。',
        `焦距保持 ${n(p.focalLengthMm)} mm；摇镜后的光轴可偏离原观看目标，不能宣称全程把人物锁在画面中心。`);
      if(id==='whip-pan')parts.push('甩镜速度由实际运动段长度和所选缓动决定，不固定为 0.4 秒；当前渲染器未模拟运动模糊，不添加已实现的拖影描述。');
    }
    if(id==='arc'||id==='orbit-360'){
      const angle=id==='arc'?p.angleDegrees:p.angleDegrees<0?-360:360;
      parts.push(`环绕角从基础方位 ${n(p.headingDegrees)}° 增至 ${n(p.headingDegrees+angle)}°，总角 ${n(angle)}°；${sample(s=>p.headingDegrees+angle*s,'°')}（主体框架时还需叠加主体当时的水平朝向）。`,
        `圆的水平半径为 ${n(p.distance)} 米，高度偏移固定 ${n(p.height)} 米；在圆周位置上始终再加基础右向 ${n(p.sideOffset)} 米。侧偏不会跟着环绕角旋转，所以圆心是基准点加这个侧偏，不保证到未偏移主体的距离恒定。`,
        '在固定世界框架、从上方观察且北在上东在右时，角度增加按南→东→北→西前进，负角度反向。主体框架下圆心和基础方位也可移动，世界轨迹不一定是固定圆。',
        `焦距保持 ${n(p.focalLengthMm)} mm，视线持续重新瞄准观看点；不把环绕误写成原地水平摇镜。`);
      if(id==='orbit-360')parts.push('完整环绕只读取 angleDegrees 的符号：非负值包含零都执行 +360°，负值执行 −360°；镜头只覆盖一部分运动段时只执行对应弧段。');
    }
    if(id==='zoom'||id==='snap-zoom'){
      const endF=p.endFocalLengthMm??70;
      parts.push(`不增加机位位移，固定传感器，焦距按进度由 ${n(p.focalLengthMm)} mm 插值至 ${n(endF)} mm；${sample(s=>p.focalLengthMm+(endF-p.focalLengthMm)*s,' mm')}。`,
        endF>p.focalLengthMm?'焦距增加、视场角收窄，形成光学推近；机位未因此向前走，不产生推进造成的透视变化。':endF<p.focalLengthMm?'焦距减小、视场角扩大，形成光学拉远；机位未因此后退。':'首尾焦距相同，没有实际变焦。',
        '焦距线性随参数进度变化，不代表视场角按时间线性变化；主体框架仍可能跟着人物移动，因此不能笼统说世界机位绝对静止。');
      if(id==='snap-zoom')parts.push('快速变焦仍使用已配置的运动时长和缓动，不是瞬间跳焦；当前未模拟运动模糊。');
    }
    if(id==='dolly-zoom')parts.push(`沿每帧基础机位朝向观看点的光轴移动 ${n(p.travel)} × 进度米，正值向前、负值后退；不把它混同普通变焦。焦距按 f = ${n(p.focalLengthMm)} × (d − ${n(p.travel)} × 进度) / d 毫米补偿，d 是该帧移动前主体的光轴深度。主体参考平面大小近似保持，背景透视改变；转身、非平面人物和移动基准不保证包围框完全不变，也不能把光轴说成跨整片固定的世界方向。`);
    if(id==='rack-focus')parts.push(`不增加机位移动、摇镜或变焦，保持基础构图和 ${n(p.focalLengthMm)} mm 焦距。清晰平面从 A：${binding(c.subject)} 过渡到 B：${c.secondary?binding(c.secondary):'未配置'}。`,
      '每帧重新计算 A、B 沿当前观看光轴的深度 dA、dB，再按 d = 1 / ((1 − 进度)/dA + 进度/dB) 设置对焦平面；不是把两个距离做算术线性插值。',
      '进度 0 时对 A，进度 1 时对 B，中间清晰平面穿过纵深；两个目标移动时焦平面会同步重算，停留并不锁死对焦米数。拉焦不代表摄影机转向 B。浅景深和纵深差决定可见虚实效果，不保证 A、B 一定交替完全模糊；两目标同深度时效果可能不明显。');
  }
  const look=c.lookTarget?binding(c.lookTarget):follow||p.frame==='subject'?binding(c.subject):`固定世界参考点 (${c.reference.target.join(', ')}) 米`;
  parts.push(`观看目标：${look}。${['pan','tilt','whip-pan'].includes(id)?'它提供叠加摇镜之前的基础瞄准。':'每次求值重新计算瞄准方向。'}`);
  if(id!=='rack-focus')parts.push(`对焦目标：${binding(c.focusTarget??c.subject)}，与观看目标独立；使用目标沿最终摄影机光轴的深度，不是到人物的直线距离。焦距不变不等于焦点距离不变。`);
  if(!follow)parts.push(`基础位置使用外向距离 ${n(p.distance)} 米、右向偏移 ${n(p.sideOffset)} 米、世界 Y 高度偏移 ${n(p.height)} 米；这些不是整机到主体的总距离。`);
  return parts.join('\n');
}
