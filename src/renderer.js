// Renderer setup: scene, camera, sky, fog, lights, and the mesh group passed to World.

import * as THREE from 'three';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc7ff);
  scene.fog = new THREE.Fog(0x8fc7ff, 60, 460);

  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 400);
  camera.rotation.order = 'YXZ';

  // hemisphere + directional sun + guaranteed ambient so no surface renders pure black
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(amb);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x87b07a, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(80, 150, 40);
  scene.add(sun);

  const meshGroup = new THREE.Group();
  scene.add(meshGroup);

  return { renderer, scene, camera, meshGroup, amb, hemi, sun };
}

export function onResize(renderer, camera, container) {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
