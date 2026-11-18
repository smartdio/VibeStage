import {Quaternion, Vector3} from 'three';

export type FramingKey = {
  time: number;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  focalScale: number;
};

// Range inputs serialize frame times as decimals; exports sample integer frame / fps.
export const framingKeyTimeTolerance = 1e-7;

export function sampleFramingKeys(keys: readonly FramingKey[] | undefined, time: number): FramingKey {
  const identity: FramingKey = {time, position:[0,0,0], quaternion:[0,0,0,1], focalScale:1};
  if (!keys?.length) return identity;
  const end = keys.findIndex(key => key.time > time);
  if (end >= 0 && keys[end].time - time <= framingKeyTimeTolerance) return structuredClone(keys[end]);
  if (end === 0) return identity;
  if (end < 0) return structuredClone(keys[keys.length - 1]);
  const a = keys[end - 1], b = keys[end];
  const u = (time - a.time) / (b.time - a.time);
  const weight = u * u * (3 - 2 * u);
  return {
    time,
    position: new Vector3(...a.position).lerp(new Vector3(...b.position), weight).toArray(),
    quaternion: new Quaternion(...a.quaternion).slerp(new Quaternion(...b.quaternion), weight).toArray(),
    focalScale: Math.exp(Math.log(a.focalScale) * (1 - weight) + Math.log(b.focalScale) * weight),
  };
}
