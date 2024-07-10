import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton';

const ARScene = () => {
  const containerRef = useRef();
  const scene = useRef(new THREE.Scene());
  const camera = useRef(new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20));
  const renderer = useRef();

  useEffect(() => {
    // Initialize renderer
    renderer.current = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.current.setSize(window.innerWidth, window.innerHeight);
    renderer.current.xr.enabled = true;
    containerRef.current.appendChild(renderer.current.domElement);

    // Add AR button
    document.body.appendChild(ARButton.createButton(renderer.current, {
      requiredFeatures: ['hit-test'], // Request hit-test feature
    }));

    // Add light
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.current.add(light);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.5 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.current.add(ground);

    // Reticle setup
    const reticleGeometry = new THREE.RingGeometry(0.1, 0.15, 32).rotateX(-Math.PI / 2);
    const reticleMaterial = new THREE.MeshBasicMaterial();
    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.current.add(reticle);

    let hitTestSource = null;
    let localSpace = null;

    const onSessionStart = async (session) => {
      const referenceSpace = await session.requestReferenceSpace('local');
      localSpace = await session.requestReferenceSpace('viewer');
      hitTestSource = await session.requestHitTestSource({ space: localSpace });

      session.addEventListener('end', () => {
        hitTestSource = null;
        localSpace = null;
      });

      renderer.current.setAnimationLoop((time, frame) => {
        if (frame) {
          const viewerPose = frame.getViewerPose(referenceSpace);
          if (viewerPose) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0) {
              const hit = hitTestResults[0];
              const hitPose = hit.getPose(referenceSpace);

              reticle.visible = true;
              reticle.matrix.fromArray(hitPose.transform.matrix);
            } else {
              reticle.visible = false;
            }
          }
        }
        renderer.current.render(scene.current, camera.current);
      });
    };

    renderer.current.xr.addEventListener('sessionstart', (event) => {
      onSessionStart(renderer.current.xr.getSession());
    });

    const onResize = () => {
      camera.current.aspect = window.innerWidth / window.innerHeight;
      camera.current.updateProjectionMatrix();
      renderer.current.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (reticle) scene.current.remove(reticle);
      renderer.current.setAnimationLoop(null);
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default ARScene;
