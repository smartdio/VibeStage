import * as THREE from 'three';

/** Ground-plane cardinal marks outside the stage: north = -Z, east = +X. */
export function createDirectionMarkers(ground?: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.name = '地面方位';
  const bounds = ground
    ? new THREE.Box3().setFromObject(ground)
    : new THREE.Box3(new THREE.Vector3(-6, 0, -5), new THREE.Vector3(6, 0, 5));
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(1, size.x / 5, size.z / 5);
  const outset = 1.15 * scale;
  const y = bounds.max.y + 0.012;
  const directions = [
    {name: '北', letter: 'N', x: center.x, z: bounds.min.z - outset, angle: 0},
    {name: '南', letter: 'S', x: center.x, z: bounds.max.z + outset, angle: Math.PI},
    {name: '东', letter: 'E', x: bounds.max.x + outset, z: center.z, angle: -Math.PI / 2},
    {name: '西', letter: 'W', x: bounds.min.x - outset, z: center.z, angle: Math.PI / 2},
  ];
  for (const direction of directions) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 320;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#dde0da';
    context.beginPath();
    context.moveTo(128, 14);
    context.lineTo(93, 60);
    context.lineTo(116, 60);
    context.lineTo(116, 92);
    context.lineTo(140, 92);
    context.lineTo(140, 60);
    context.lineTo(163, 60);
    context.closePath();
    context.fill();
    context.textAlign = 'center';
    context.font = '700 128px "PingFang SC", system-ui, sans-serif';
    context.fillText(direction.name, 128, 222);
    context.font = '600 42px system-ui, sans-serif';
    context.fillText(direction.letter, 128, 284);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15 * scale, 1.35 * scale),
      new THREE.MeshBasicMaterial({
        map: texture, transparent: true, opacity: 0.82, depthTest: true, depthWrite: false,
        toneMapped: false, polygonOffset: true,
        polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }),
    );
    mark.name = direction.name;
    mark.position.set(direction.x, y, direction.z);
    mark.rotation.set(-Math.PI / 2, 0, direction.angle);
    group.add(mark);
  }
  return group;
}
