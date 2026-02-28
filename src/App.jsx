import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Cloud, ContactShadows, Html, Float, Environment, MeshDistortMaterial, RoundedBox } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// --- GAME STATE ---
const useStore = create((set) => ({
  money: 100, day: 1, inventory: [], maxCapacity: 3, customersServed: 0, gameState: 'START',
  unlockedAnimals: ['chicken'], 
  unlockedCrops: ['carrot'],
  
  startDay: () => set({ gameState: 'PLAYING', customersServed: 0, inventory: [] }),
  addItem: (item) => set((s) => s.inventory.length < s.maxCapacity ? { inventory: [...s.inventory, item] } : s),
  serve: () => set((s) => {
    const total = s.customersServed + 1;
    return { 
      money: s.money + 50, 
      customersServed: total, 
      inventory: [], 
      gameState: total >= 10 ? 'SHOP' : 'PLAYING' 
    };
  }),
  buyUpgrade: (type, cost, nextItem) => set((s) => {
    if (s.money < cost) return s;
    const update = type === 'animal' ? { unlockedAnimals: [...s.unlockedAnimals, nextItem] } : { unlockedCrops: [...s.unlockedCrops, nextItem] };
    return { ...update, money: s.money - cost };
  }),
  nextDay: () => set((s) => ({ day: s.day + 1, gameState: 'START' }))
}));

// --- BEAUTIFUL TREE ---
function ForestTree({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1, 0]}>
        <cylinderGeometry args={[0.2, 0.4, 2, 8]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      <mesh castShadow position={[0, 2.5, 0]}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <MeshDistortMaterial color="#1b5e20" speed={2} distort={0.2} radius={1} />
      </mesh>
    </group>
  );
}

// --- CHARACTER WITH QUEUE LOGIC ---
function ChibiCharacter({ color, position, isPlayer = false, holding = [], orderItem = null }) {
  const group = useRef();
  const body = useRef();
  const [lLeg, rLeg] = [useRef(), useRef()];
  const [keys, setKeys] = useState({});

  useEffect(() => {
    if (!isPlayer) return;
    const down = (e) => setKeys(k => ({ ...k, [e.code]: true }));
    const up = (e) => setKeys(k => ({ ...k, [e.code]: false }));
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [isPlayer]);

  useFrame((state, delta) => {
    if (isPlayer && group.current) {
      const move = new THREE.Vector3(0,0,0);
      if (keys.KeyW || keys.ArrowUp) move.z -= 1;
      if (keys.KeyS || keys.ArrowDown) move.z += 1;
      if (keys.KeyA || keys.ArrowLeft) move.x -= 1;
      if (keys.KeyD || keys.ArrowRight) move.x += 1;
      if (move.length() > 0) {
        move.normalize().multiplyScalar(8 * delta);
        group.current.position.add(move);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, Math.atan2(move.x, move.z), 0.15);
      }
      state.camera.position.lerp(new THREE.Vector3(group.current.position.x + 10, 12, group.current.position.z + 10), 0.1);
      state.camera.lookAt(group.current.position);
    }
    const t = state.clock.elapsedTime;
    lLeg.current.rotation.x = Math.sin(t * 10) * 0.4;
    rLeg.current.rotation.x = Math.cos(t * 10) * 0.4;
    body.current.position.y = 0.8 + Math.sin(t * 20) * 0.05;
  });

  return (
    <group ref={group} position={position}>
      <group ref={body}>
        <RoundedBox args={[0.7, 0.8, 0.6]} radius={0.15} castShadow><meshStandardMaterial color={color} /></RoundedBox>
        <mesh position={[0, 0.7, 0]} castShadow><sphereGeometry args={[0.35]} /><meshStandardMaterial color="#ffdbac" /></mesh>
        
        {/* Thought Bubble for Orders */}
        {orderItem && (
          <Html position={[0, 1.8, 0]} center>
            <div className="order-bubble">
               <span style={{fontSize: '24px'}}>{orderItem === 'egg' ? '🥚' : '🥕'}</span>
            </div>
          </Html>
        )}

        {/* Items Held */}
        {holding.map((item, i) => (
          <mesh key={i} position={[0, 0.2 + i * 0.25, 0.4]}><sphereGeometry args={[0.12]} /><meshStandardMaterial color="white" /></mesh>
        ))}
      </group>
      <mesh ref={lLeg} position={[-0.2, 0.2, 0]}><capsuleGeometry args={[0.1, 0.3]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh ref={rLeg} position={[0.2, 0.2, 0]}><capsuleGeometry args={[0.1, 0.3]} /><meshStandardMaterial color="#111" /></mesh>
    </group>
  );
}

// --- MAIN SCENE ---
export default function App() {
  const s = useStore();
  
  // Logic to determine what the customer in line wants
  const currentOrder = s.customersServed % 2 === 0 ? 'egg' : 'carrot';

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1b5e20' }}>
      <Canvas shadows camera={{ position: [12, 12, 12], fov: 35 }}>
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="forest" />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
          
          {/* Deep Green Grass */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#2e7d32" />
          </mesh>

          {/* Trees around the farm */}
          <ForestTree position={[-12, 0, -12]} />
          <ForestTree position={[12, 0, -12]} />
          <ForestTree position={[-15, 0, 5]} />

          {/* Farm Stations */}
          <group position={[-6, 0, 4]} onClick={() => s.addItem('egg')}>
             <RoundedBox args={[3, 2, 3]} radius={0.2} position={[0, 1, 0]} castShadow><meshStandardMaterial color="#5d4037" /></RoundedBox>
             <Html position={[0, 3.5, 0]} center><div className="label">🐔 COOP</div></Html>
          </group>

          {/* Customer Line System */}
          <group position={[5, 0, 0]}>
            <mesh position={[0, 0.5, 0]}><boxGeometry args={[2, 1, 4]} /><meshStandardMaterial color="#795548" /></mesh>
            <Html position={[0, 1.2, 0]} center><div className="label">COUNTER</div></Html>
            
            {/* The Queue (Current customer + 2 waiting) */}
            {[0, 1, 2].map((i) => {
               const isTarget = i === 0;
               return (
                 <group key={i} position={[0, 0.6, 2 + i * 2.5]} onClick={() => isTarget && s.inventory.includes(currentOrder) && s.serve()}>
                    <ChibiCharacter 
                      color={isTarget ? "#3f51b5" : "#9e9e9e"} 
                      orderItem={isTarget ? currentOrder : null}
                    />
                 </group>
               );
            })}
          </group>

          {s.gameState === 'PLAYING' && <ChibiCharacter color="#ffd600" isPlayer position={[0,0,0]} holding={s.inventory} />}
          <ContactShadows opacity={0.4} scale={40} blur={2} />
        </Suspense>
      </Canvas>

      <div className="hud">
        <div className="stats">💰 {s.money}g | 📅 Day {s.day} | 📦 {s.inventory.length}/{s.maxCapacity}</div>
        {s.gameState === 'START' && (
          <div className="overlay">
            <h1>Day {s.day}</h1>
            <p>Walk to the counter to serve the line!</p>
            <button onClick={s.startDay}>Open Farm</button>
          </div>
        )}
        {s.gameState === 'SHOP' && (
          <div className="overlay shop">
            <h2>Market Closed</h2>
            <button onClick={() => s.buyUpgrade('animal', 200, 'duck')} disabled={s.unlockedAnimals.includes('duck')}>Unlock Duck (200g)</button>
            <button onClick={s.nextDay}>Sleep</button>
          </div>
        )}
      </div>

      <style>{`
        .hud { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; color: white; font-family: 'Arial', sans-serif; }
        .stats { padding: 20px; font-size: 24px; background: rgba(0,0,0,0.5); border-bottom-right-radius: 20px; display: inline-block; }
        .overlay { pointer-events: auto; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(20,40,20,0.9); padding: 50px; border-radius: 30px; text-align: center; border: 2px solid #ffd600; }
        .order-bubble { background: white; padding: 10px; border-radius: 50%; border: 3px solid #3f51b5; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .label { background: rgba(0,0,0,0.7); padding: 5px 15px; border-radius: 20px; font-weight: bold; font-size: 12px; border: 1px solid gold; }
        button { padding: 15px 30px; font-size: 20px; cursor: pointer; background: #ffd600; border: none; border-radius: 10px; font-weight: bold; }
        button:disabled { opacity: 0.3; }
      `}</style>
    </div>
  );
}
