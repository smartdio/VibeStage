export type FramingTiming='whole'|'key';
export type TimingProps={timing:FramingTiming;onTiming:(value:FramingTiming)=>void};

export function FramingTimingSelect({timing,onTiming,disabled=false}:TimingProps & {disabled?:boolean}){
  return <label>构图生效范围
    <select aria-label="构图生效范围" disabled={disabled} value={timing} onChange={event=>onTiming(event.target.value as FramingTiming)}>
      <option value="whole">整个镜头</option>
      <option value="key">当前时间点（关键帧）</option>
    </select>
  </label>;
}
