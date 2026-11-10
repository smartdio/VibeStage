import type {ScenePerformance,PerformanceContext} from './performances';
import type {CameraPresetConfig} from './camera-presets';
import {validateCameraSetup, type CameraMetadata, type CameraCut} from './cameras';
import type { Camera, Object3D, Scene } from 'three';
export interface OutputSettings { width: number; height: number; fps: number }
export interface CameraLesson { purpose:string;observe:string;tryThis:string }
export interface StageScene {
  name: string;
  description?: string;
  /** Optional onboarding view and per-camera learning notes; neither enters exported pixels. */
  initialView?: 'free'|'shot';
  cameraLessons?: Record<string,CameraLesson>;
  scene: Scene;
  cameras: Record<string, Camera>;
  /** Optional physical lens metadata; absent entries retain legacy FOV behavior. */
  cameraMetadata?: Record<string, CameraMetadata>;
  /** Optional deterministic camera presets, evaluated after scene animation. */
  cameraPresets?: Record<string, CameraPresetConfig>;
  /** Selected virtual camera ID -> continuous edit timeline; each cut may choose independent performance. */
  cameraCuts?: Record<string, CameraCut[]>;
  durationSeconds: number;
  output: OutputSettings;
  /** Optional labeled handles for inspection; raw scene objects always remain available. */
  subjects?: Record<string, Object3D>;
  /** Named deterministic action layers authored in scene code. */
  performances?: Record<string, ScenePerformance>;
  /** Runs after action and shot placement; put subject-following camera motion here. */
  updateCameras?(timeSeconds:number,context?:PerformanceContext):void;
  update(timeSeconds: number,context?:PerformanceContext): void;
  dispose(): void;
}
export type SceneFactory = () => StageScene | Promise<StageScene>;
export function validateScene(value: StageScene): void {
  if (!value?.scene?.isScene) throw new Error('createScene() 必须返回 Three.js Scene');
  if (typeof value.update !== 'function' || typeof value.dispose !== 'function') throw new Error('场景需要 update(timeSeconds) 与 dispose()');
  if (!Number.isFinite(value.durationSeconds) || value.durationSeconds <= 0 || value.durationSeconds > 300) throw new Error('场景时长必须在 0–300 秒之间');
  if (!value.cameras || !Object.keys(value.cameras).length || Object.values(value.cameras).some(c => !c?.isCamera)) throw new Error('场景至少需要一个有效摄影机');
  for(const [id,take] of Object.entries(value.performances??{}))if(!id||id.length>128||['__proto__','constructor','prototype'].includes(id)||typeof take?.update!=='function'||(take.label!==undefined&&(typeof take.label!=='string'||take.label.length>300)))throw new Error('表演动作需要有效 ID 和 update(timeSeconds)');
  validateCameraSetup(value);
  const o = value.output;
  if (!o || ![o.width,o.height,o.fps].every(Number.isInteger) || o.width < 16 || o.height < 16 || o.width > 1920 || o.height > 1920 || o.width % 2 || o.height % 2 || o.fps < 1 || o.fps > 60) throw new Error('输出需为 16–1920 的偶数尺寸，帧率 1–60');
}
export function frameTimes(duration: number, fps: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(fps) || fps < 1 || fps > 60 || duration > 300) throw new Error('无效的时长或帧率');
  return Array.from({length: Math.ceil(duration * fps - 1e-8)}, (_, n) => n / fps);
}
