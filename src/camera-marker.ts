import * as T from 'three';

// The optical centre is the lens tip. The camera looks along its local -Z axis.
export function createCameraMarker() {
  const marker = new T.Group();
  marker.name = '当前拍摄机位';
  const amber = new T.MeshBasicMaterial({color: '#ffb04e', toneMapped: false});
  const dark = new T.MeshBasicMaterial({color: '#352b23', toneMapped: false});

  const body = new T.Mesh(new T.BoxGeometry(.55, .38, .54), amber);
  body.position.z = .49;
  const lens = new T.Mesh(new T.CylinderGeometry(.15, .19, .22, 16), dark);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = .11;
  const finder = new T.Mesh(new T.BoxGeometry(.23, .12, .24), dark);
  finder.position.set(0, .25, .53);

  // A short viewfinder outline shows aim and roll without covering the set.
  const outline = new T.LineBasicMaterial({color: '#a7570c', toneMapped: false});
  const corners = [
    new T.Vector3(-.5, -.3, -1), new T.Vector3(.5, -.3, -1),
    new T.Vector3(.5, .3, -1), new T.Vector3(-.5, .3, -1),
  ];
  const segments = corners.flatMap((corner, index) => [
    new T.Vector3(), corner, corner, corners[(index + 1) % corners.length],
  ]);
  const aim = new T.LineSegments(new T.BufferGeometry().setFromPoints(segments), outline);
  aim.name='取景线框';
  marker.add(body, lens, finder, aim);
  marker.matrixAutoUpdate = false;
  return marker;
}
