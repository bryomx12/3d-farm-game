import React, { useState, useRef, useEffect, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, ContactShadows, Html, Environment } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// 1. GAME DATA
const useStore = create((set) => ({
  money: 0, day: 1, inventory: [], gameState: 'START',
  startDay: () => set({ gameState: 'PLAYING', inventory: [] }),
  addItem: (item) => set((s) => s.inventory.length < 3 ? { inventory: [...s.inventory, item] } : s),
  serve: (item) => set((s) => {
    if (!s.inventory.includes(item)) return s;
    const newInv = [...s.inventory];
    newInv.splice(s.inventory.indexOf(item), 1);
    return { money: s.money + 50, inventory: newInv };
  })
}));

// 2. PLAYER
function Player() {
  const mesh = useRef();
  const [keys, setKeys] = useState({});
  useEffect(() => {
    const h = (e, v) => setKeys(k => ({ ...k, [e.code]: v }));
    window.addEventListener('keydown', (e) => h(e, true));
    window.addEventListener('keyup', (e) => h(e, false));
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('keyup', h); };
  }, []);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    const move = new THREE.Vector3(0,0,0);
    if (keys.KeyW || keys.ArrowUp) move.z -= 1;
    if (keys.KeyS || keys.ArrowDown) move.z += 1;
    if (keys.KeyA || keys.ArrowLeft) move.x -= 1;
    if (keys.KeyD || keys.ArrowRight) move.x += 1;
    if (move.length() > 0) {
      move.normalize().multiplyScalar(8 * delta);
      mesh.current.position.add(move);
      mesh.current.rotation.y = Math.atan2(move.x, move.z);
    }
    state.camera.position.lerp(new THREE.Vector3(mesh.current.position.x + 10, 10, mesh.current.position.z + 10), 0.1);
    state.camera.lookAt(mesh.current.position);
  });

  return (
    <mesh ref={mesh} position={[0, 0.6, 0]} castShadow>
      <boxGeometry args={[0.6, 1, 0.6]} />
      <meshStandardMaterial color="#ffd600" />
    </mesh>
  );
}

// 3. THE WORLD
function Game() {
  const s = useStore();
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a210f' }}>
      <Canvas shadows camera={{ position: [15, 15, 15] }}>
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="forest" />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
          
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#1b5e20" />
          </mesh>

          {/* Chicken Station */}
          <group position={[-5, 0, 5]} onClick={() => s.addItem('egg')}>
            <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[2, 1, 2]} /><meshStandardMaterial color="#5d4037" /></mesh>
            <Html position={[0, 1.5, 0]} center><div style={{background: 'black', color: 'white', padding: '5px'}}>COOP (Click)</div></Html>
          </group>

          {/* Customer */}
          <group position={[0, 0, -5]} onClick={() => s.serve('egg')}>
            <mesh position={[0, 0.5, 0]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="blue" /></mesh>
            <Html position={[0, 2, 0]} center><div style={{background: 'white', color: 'black', padding: '10px'}}>WANT: EGG</div></Html>
          </group>

          {s.gameState === 'PLAYING' && <Player />}
          <ContactShadows opacity={0.5} scale={30} blur={2} />
        </Suspense>
      </Canvas>

      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none' }}>
        <h1>💰 {s.money}g</h1>
        <p>Items: {s.inventory.length}/3</p>
      </div>

      {s.gameState === 'START' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <button onClick={s.startDay} style={{ padding: '20px 40px', fontSize: '24px', cursor: 'pointer', background: 'gold', border: 'none' }}>START GAME</button>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Game />);
