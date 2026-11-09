import type {CameraPresetConfig} from './camera-presets';
import {validateCameraSetup, type CameraMetadata, type CameraCut} from './cameras';
import type { Camera, Object3D, Scene } from 'three';
export interface OutputSettings { width: number; height: number; fps: number }
export interface StageScene {
  name: string;
  description?: string;
  scene: Scene;
  cameras: Record<string, Camera>;
  /** Optional physical lens metadata; absent entries retain legacy FOV behavior. */
  cameraMetadata?: Record<string, CameraMetadata>;
  /** Optional deterministic camera presets, evaluated after scene animation. */
  cameraPresets?: Record<string, CameraPresetConfig>;
  /** Selected virtual camera ID -> continuous source-camera cuts. */
  cameraCuts?: Record<string, CameraCut[]>;
  durationSeconds: number;
  output: OutputSettings;
  /** Optional labeled handles for inspection; raw scene objects always remain available. */
  subjects?: Record<string, Object3D>;
  update(timeSeconds: number): void;
  dispose(): void;
}
export type SceneFactory = () => StageScene | Promise<StageScene>;
export function validateScene(value: StageScene): void {
  if (!value?.scene?.isScene) throw new Error('createScene() 必须返回 Three.js Scene');
  if (typeof value.update !== 'function' || typeof value.dispose !== 'function') throw new Error('场景需要 update(timeSeconds) 与 dispose()');
  if (!Number.isFinite(value.durationSeconds) || value.durationSeconds <= 0 || value.durationSeconds > 300) throw new Error('场景时长必须在 0–300 秒之间');
  if (!value.cameras || !Object.keys(value.cameras).length || Object.values(value.cameras).some(c => !c?.isCamera)) throw new Error('场景至少需要一个有效摄影机');
  validateCameraSetup(value);
  const o = value.output;
  if (!o || ![o.width,o.height,o.fps].every(Number.isInteger) || o.width < 16 || o.height < 16 || o.width > 1920 || o.height > 1920 || o.width % 2 || o.height % 2 || o.fps < 1 || o.fps > 60) throw new Error('输出需为 16–1920 的偶数尺寸，帧率 1–60');
}
export function frameTimes(duration: number, fps: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(fps) || fps < 1 || fps > 60 || duration > 300) throw new Error('无效的时长或帧率');
  return Array.from({length: Math.ceil(duration * fps - 1e-8)}, (_, n) => n / fps);
}
