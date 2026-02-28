import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Cloud, ContactShadows, Html, Float, Environment, MeshDistortMaterial, RoundedBox } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// --- GAME STATE ---
const useStore = create((set) => ({
  money: 0, day: 1, inventory: [], maxCapacity: 3, customersServed: 0, gameState: 'START',
  startDay: () => set({ gameState: 'PLAYING', customersServed: 0, inventory: [] }),
  addItem: (item) => set((s) => s.inventory.length < s.maxCapacity ? { inventory: [...s.inventory, item] } : s),
  serve: (itemType) => set((s) => {
    if (!s.inventory.includes(itemType)) return s;
    const total = s.customersServed + 1;
    return { money: s.money + (itemType === 'egg' ? 20 : 50), customersServed: total, inventory: [], gameState: total >= 10 ? 'SHOP' : 'PLAYING' };
  }),
  upgrade: (cost) => set((s) => ({ money: s.money - cost, maxCapacity: s.maxCapacity + 2 })),
  nextDay: () => set((s) => ({ day: s.day + 1, gameState: 'START' }))
}));

// --- GRASS PATCHES ---
function Grass({ position }) {
  return (
    <group position={position}>
      <mesh rotation={[0, Math.random() * Math.PI, 0]}>
        <coneGeometry args={[0.05, 0.4, 3]} />
        <meshStandardMaterial color="#9ccc65" />
      </mesh>
      <mesh position={[0.1, 0, 0.1]} rotation={[0.2, Math.random(), 0]}>
        <coneGeometry args={[0.05, 0.3, 3]} />
        <meshStandardMaterial color="#c5e1a5" />
      </mesh>
    </group>
  );
}

// --- ANIMATED CHARACTER WITH LIMBS ---
function ChibiCharacter({ color, position, isPlayer = false }) {
  const group = useRef();
  const body = useRef();
  const lLeg = useRef();
  const rLeg = useRef();
  const lArm = useRef();
  const rArm = useRef();
  const [keys, setKeys] = useState({});
  const inventory = useStore(s => s.inventory);

  useEffect(() => {
    if (!isPlayer) return;
    const down = (e) => setKeys(k => ({ ...k, [e.code]: true }));
    const up = (e) => setKeys(k => ({ ...k, [e.code]: false }));
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [isPlayer]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    let isMoving = false;

    if (isPlayer && group.current) {
      const speed = 7;
      let move = new THREE.Vector3(0, 0, 0);
      if (keys.KeyW || keys.ArrowUp) move.z -= 1;
      if (keys.KeyS || keys.ArrowDown) move.z += 1;
      if (keys.KeyA || keys.ArrowLeft) move.x -= 1;
      if (keys.KeyD || keys.ArrowRight) move.x += 1;
      
      if (move.length() > 0) {
        isMoving = true;
        move.normalize().multiplyScalar(speed * delta);
        group.current.position.add(move);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, Math.atan2(move.x, move.z), 0.15);
      }
      state.camera.position.lerp(new THREE.Vector3(group.current.position.x + 8, 12, group.current.position.z + 8), 0.1);
      state.camera.lookAt(group.current.position);
    }

    // --- ANIMATION LOGIC ---
    if (isMoving) {
      const walkSpeed = 12;
      lLeg.current.rotation.x = Math.sin(t * walkSpeed) * 0.5;
      rLeg.current.rotation.x = Math.cos(t * walkSpeed) * 0.5;
      lArm.current.rotation.x = Math.cos(t * walkSpeed) * 0.4;
      rArm.current.rotation.x = Math.sin(t * walkSpeed) * 0.4;
      body.current.position.y = 0.8 + Math.sin(t * walkSpeed * 2) * 0.05;
    } else {
      lLeg.current.rotation.x = 0;
      rLeg.current.rotation.x = 0;
      lArm.current.rotation.x = 0;
      rArm.current.rotation.x = 0;
      body.current.position.y = 0.8;
    }
  });

  return (
    <group ref={group} position={position}>
      <group ref={body} position={[0, 0.8, 0]}>
        {/* Body & Head */}
        <RoundedBox args={[0.7, 0.8, 0.6]} radius={0.2} castShadow><meshStandardMaterial color={color} /></RoundedBox>
        <mesh position={[0, 0.7, 0]} castShadow><sphereGeometry args={[0.35, 16, 16]} /><meshStandardMaterial color="#ffdbac" /></mesh>
        
        {/* Held Items (Stacked in arms) */}
        <group position={[0, 0.1, 0.4]}>
          {inventory.map((item, i) => (
             <mesh key={i} position={[0, i * 0.25, 0]}>
               {item === 'egg' ? <sphereGeometry args={[0.15]} /> : <coneGeometry args={[0.15, 0.3]} />}
               <meshStandardMaterial color={item === 'egg' ? "white" : "orange"} />
             </mesh>
          ))}
        </group>

        {/* Arms */}
        <mesh ref={lArm} position={[-0.45, 0, 0]}><capsuleGeometry args={[0.1, 0.4]} /><meshStandardMaterial color={color} /></mesh>
        <mesh ref={rArm} position={[0.45, 0, 0]}><capsuleGeometry args={[0.1, 0.4]} /><meshStandardMaterial color={color} /></mesh>
      </group>

      {/* Legs */}
      <mesh ref={lLeg} position={[-0.2, 0.2, 0]}><capsuleGeometry args={[0.12, 0.4]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh ref={rLeg} position={[0.2, 0.2, 0]}><capsuleGeometry args={[0.12, 0.4]} /><meshStandardMaterial color="#333" /></mesh>
    </group>
  );
}

// --- MAIN FARM SCENE ---
export default function App() {
  const s = useStore();
  const grassCoords = useMemo(() => Array.from({ length: 40 }, () => [Math.random() * 30 - 15, 0, Math.random() * 30 - 15]), []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#87ceeb' }}>
      <Canvas shadows camera={{ position: [10, 10, 10], fov: 35 }}>
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 20, 100]} inclination={0.6} />
          <Environment preset="park" />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />

          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#7cb342" />
          </mesh>

          {grassCoords.map((pos, i) => <Grass key={i} position={pos} />)}
          
          {/* Use ChibiCharacter for Player and Customers */}
          {s.gameState === 'PLAYING' && <ChibiCharacter color="#ffcc00" isPlayer position={[0, 0, 0]} />}
          
          <group position={[0, 0, -8]} onClick={() => s.serve(s.customersServed % 2 === 0 ? 'egg' : 'veggie')}>
            <ChibiCharacter color="#3f51b5" position={[0, 0, 0]} />
            <Html position={[0, 2.5, 0]}><div className="label">Order: {s.customersServed % 2 === 0 ? '🥚' : '🥕'}</div></Html>
          </group>

          {/* Functional Farm Objects */}
          <group position={[-5, 0, 5]} onClick={() => s.addItem('egg')}>
             <RoundedBox args={[2, 1.5, 2]} radius={0.1} position={[0, 0.75, 0]}><meshStandardMaterial color="#a1887f" /></RoundedBox>
             <Html position={[0, 2.5, 0]}><div className="label">🐔 Coop</div></Html>
          </group>

          <ContactShadows opacity={0.4} scale={40} blur={2} />
        </Suspense>
      </Canvas>

      <div className="hud">
        <div className="stats">💰 {s.money}g | 📅 Day {s.day} | 📦 {s.inventory.length}/{s.maxCapacity}</div>
        {s.gameState === 'START' && (
          <div className="overlay">
            <h1>Harvest Valley</h1>
            <button onClick={s.startDay}>Begin Day {s.day}</button>
          </div>
        )}
      </div>

      <style>{`
        .hud { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; color: white; font-family: 'Patrick Hand', cursive; }
        .stats { padding: 20px; font-size: 28px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
        .overlay { pointer-events: auto; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); padding: 50px; border-radius: 40px; text-align: center; }
        .label { background: rgba(255,255,255,0.2); backdrop-filter: blur(5px); padding: 5px 15px; border-radius: 20px; font-size: 16px; border: 1px solid rgba(255,255,255,0.4); }
        button { padding: 15px 40px; font-size: 24px; cursor: pointer; background: #ffcc00; border: none; border-radius: 50px; font-weight: bold; }
      `}</style>
    </div>
  );
}
