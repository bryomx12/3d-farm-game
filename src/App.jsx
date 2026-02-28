import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Cloud, ContactShadows, Html, Environment, MeshDistortMaterial, RoundedBox } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// --- 1. ENHANCED GAME STATE ---
const useStore = create((set) => ({
  money: 100, day: 1, inventory: [], maxCapacity: 3, customersServed: 0, gameState: 'START',
  unlockedAnimals: ['chicken'], // chicken -> duck -> sheep -> cow
  unlockedCrops: ['carrot'],   // carrot -> tomato -> cabbage
  
  startDay: () => set({ gameState: 'PLAYING', customersServed: 0, inventory: [] }),
  addItem: (item) => set((s) => s.inventory.length < s.maxCapacity ? { inventory: [...s.inventory, item] } : s),
  serve: (itemType) => set((s) => {
    if (!s.inventory.includes(itemType)) return s;
    const rewards = { egg: 20, duck_egg: 40, sheep_milk: 70, cow_milk: 120, carrot: 25, tomato: 50, cabbage: 90 };
    const total = s.customersServed + 1;
    return { money: s.money + (rewards[itemType] || 20), customersServed: total, inventory: [], gameState: total >= 10 ? 'SHOP' : 'PLAYING' };
  }),
  buyUpgrade: (type, cost, nextItem) => set((s) => {
    if (s.money < cost) return s;
    const key = type === 'animal' ? 'unlockedAnimals' : 'unlockedCrops';
    return { money: s.money - cost, [key]: [...s[key], nextItem] };
  }),
  nextDay: () => set((s) => ({ day: s.day + 1, gameState: 'START' }))
}));

// --- 2. LUSH FOREST TREE ---
function ForestTree({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1, 0]}><cylinderGeometry args={[0.2, 0.4, 2]} /><meshStandardMaterial color="#2b1d0e" /></mesh>
      <mesh castShadow position={[0, 2.5, 0]}>
        <sphereGeometry args={[1.3, 16, 16]} />
        <MeshDistortMaterial color="#1b5e20" speed={2} distort={0.2} radius={1} />
      </mesh>
    </group>
  );
}

// --- 3. REFINED CHARACTER WITH HANDS/FEET ---
function ChibiCharacter({ color, position, isPlayer = false, orderItem = null, holding = [] }) {
  const group = useRef();
  const body = useRef();
  const [lLeg, rLeg, lArm, rArm] = [useRef(), useRef(), useRef(), useRef()];
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
    const t = state.clock.elapsedTime;
    let moving = false;
    if (isPlayer && group.current) {
      const move = new THREE.Vector3(0,0,0);
      if (keys.KeyW || keys.ArrowUp) move.z -= 1;
      if (keys.KeyS || keys.ArrowDown) move.z += 1;
      if (keys.KeyA || keys.ArrowLeft) move.x -= 1;
      if (keys.KeyD || keys.ArrowRight) move.x += 1;
      if (move.length() > 0) {
        moving = true;
        move.normalize().multiplyScalar(8 * delta);
        group.current.position.add(move);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, Math.atan2(move.x, move.z), 0.15);
      }
      state.camera.position.lerp(new THREE.Vector3(group.current.position.x + 10, 12, group.current.position.z + 10), 0.1);
      state.camera.lookAt(group.current.position);
    }
    const speed = moving ? 12 : 2;
    lLeg.current.rotation.x = Math.sin(t * speed) * 0.5;
    rLeg.current.rotation.x = Math.cos(t * speed) * 0.5;
    body.current.position.y = 0.8 + Math.sin(t * speed * 2) * 0.04;
  });

  return (
    <group ref={group} position={position}>
      <group ref={body}>
        <RoundedBox args={[0.7, 0.8, 0.6]} radius={0.15} castShadow><meshStandardMaterial color={color} /></RoundedBox>
        <mesh position={[0, 0.7, 0]} castShadow><sphereGeometry args={[0.35]} /><meshStandardMaterial color="#ffdbac" /></mesh>
        <mesh ref={lArm} position={[-0.45, 0, 0]}><capsuleGeometry args={[0.1, 0.3]} /><meshStandardMaterial color={color} /></mesh>
        <mesh ref={rArm} position={[0.45, 0, 0]}><capsuleGeometry args={[0.1, 0.3]} /><meshStandardMaterial color={color} /></mesh>
        
        {orderItem && (
          <Html position={[0, 1.8, 0]} center>
            <div className="order-bubble">{orderItem === 'egg' ? '🥚' : orderItem === 'duck_egg' ? '🪺' : orderItem === 'sheep_milk' ? '🥛' : '🥕'}</div>
          </Html>
        )}
        
        {holding.map((item, i) => (
          <mesh key={i} position={[0, 0.2 + i * 0.2, 0.4]} castShadow><sphereGeometry args={[0.12]} /><meshStandardMaterial color="white" /></mesh>
        ))}
      </group>
      <mesh ref={lLeg} position={[-0.2, 0.2, 0]}><capsuleGeometry args={[0.1, 0.3]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh ref={rLeg} position={[0.2, 0.2, 0]}><capsuleGeometry args={[0.1, 0.3]} /><meshStandardMaterial color="#111" /></mesh>
    </group>
  );
}

// --- 4. UPGRADABLE VEGETABLE PATCH ---
function VegetablePatch({ position }) {
  const { unlockedCrops, addItem } = useStore();
  const [stage, setStage] = useState('EMPTY');
  const [growth, setGrowth] = useState(0);
  const currentCrop = unlockedCrops[unlockedCrops.length - 1];

  useFrame((_, delta) => {
    if (stage === 'WATERED' && growth < 100) setGrowth(g => g + delta * 25);
    else if (growth >= 100) setStage('READY');
  });

  const cropColors = { carrot: 'orange', tomato: '#e53935', cabbage: '#43a047' };

  return (
    <group position={position} onClick={() => {
      if (stage === 'EMPTY') setStage('WATERED');
      else if (stage === 'READY') { addItem(currentCrop); setStage('EMPTY'); setGrowth(0); }
    }}>
      <RoundedBox args={[2.5, 0.2, 2.5]} radius={0.1}><meshStandardMaterial color="#3e2723" /></RoundedBox>
      {stage !== 'EMPTY' && (
        <mesh position={[0, growth/200, 0]}>
          <sphereGeometry args={[growth/200]} />
          <meshStandardMaterial color={cropColors[currentCrop]} />
        </mesh>
      )}
      <Html position={[0, 1.5, 0]} center><div className="label">{stage === 'READY' ? `Harvest ${currentCrop}` : stage === 'WATERED' ? 'Growing...' : 'Water Soil'}</div></Html>
    </group>
  );
}

// --- 5. MAIN APP ---
export default function App() {
  const s = useStore();
  
  // Choose random item from unlocked lists for orders
  const getOrder = () => {
    const pool = [...s.unlockedAnimals.map(a => a === 'chicken' ? 'egg' : a === 'duck' ? 'duck_egg' : 'sheep_milk'), ...s.unlockedCrops];
    return pool[s.customersServed % pool.length];
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a210f' }}>
      <Canvas shadows camera={{ position: [12, 12, 12], fov: 35 }}>
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="forest" />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
          
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#1b5e20" /></mesh>

          <ForestTree position={[-12, 0, -10]} /><ForestTree position={[12, 0, -10]} /><ForestTree position={[-15, 0, 8]} />

          <VegetablePatch position={[6, 0, -4]} />

          <group position={[-6, 0, 4]} onClick={() => {
             const a = s.unlockedAnimals;
             s.addItem(a.includes('sheep') ? 'sheep_milk' : a.includes('duck') ? 'duck_egg' : 'egg');
          }}>
             <RoundedBox args={[3, 2, 3]} radius={0.2} position={[0, 1, 0]} castShadow><meshStandardMaterial color="#5d4037" /></RoundedBox>
             <Html position={[0, 3.5, 0]} center><div className="label">ANIMAL COOP</div></Html>
          </group>

          {/* Customer Queue */}
          <group position={[0, 0, -10]}>
            <mesh position={[0, 0.5, 0]}><boxGeometry args={[4, 1, 2]} /><meshStandardMaterial color="#4e342e" /></mesh>
            {[0, 1, 2].map((i) => (
              <group key={i} position={[i * -2.5, 0, 2.5]} onClick={() => i === 0 && s.serve(getOrder())}>
                <ChibiCharacter color={i === 0 ? "#3f51b5" : "#777"} orderItem={i === 0 ? getOrder() : null} />
              </group>
            ))}
          </group>

          {s.gameState === 'PLAYING' && <ChibiCharacter color="#ffd600" isPlayer position={[0,0,0]} holding={s.inventory} />}
          <ContactShadows opacity={0.4} scale={40} blur={2} />
        </Suspense>
      </Canvas>

      <div className="hud">
        <div className="stats">💰 {s.money}g | 📅 Day {s.day} | 📦 {s.inventory.length}/{s.maxCapacity}</div>
        {s.gameState === 'START' && (
          <div className="overlay"><h1>Day {s.day}</h1><button onClick={s.startDay}>Begin Farming</button></div>
        )}
        {s.gameState === 'SHOP' && (
          <div className="overlay shop">
            <h2>Upgrades Available</h2>
            {!s.unlockedAnimals.includes('duck') && <button onClick={() => s.buyUpgrade('animal', 200, 'duck')}>Unlock Duck (200g)</button>}
            {!s.unlockedAnimals.includes('sheep') && s.unlockedAnimals.includes('duck') && <button onClick={() => s.buyUpgrade('animal', 500, 'sheep')}>Unlock Sheep (500g)</button>}
            {!s.unlockedCrops.includes('tomato') && <button onClick={() => s.buyUpgrade('crop', 150, 'tomato')}>Tomato Seeds (150g)</button>}
            <button onClick={s.nextDay}>Sleep</button>
          </div>
        )}
      </div>

      <style>{`
        .hud { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; color: white; font-family: 'Patrick Hand', cursive; }
        .stats { padding: 20px; font-size: 24px; background: rgba(0,0,0,0.6); border-bottom-right-radius: 20px; display: inline-block; }
        .overlay { pointer-events: auto; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(10,30,10,0.95); padding: 40px; border-radius: 30px; text-align: center; border: 2px solid #ffd600; }
        .order-bubble { background: white; padding: 10px; border-radius: 50%; border: 3px solid #3f51b5; font-size: 24px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .label { background: rgba(0,0,0,0.7); padding: 5px 12px; border-radius: 10px; font-size: 14px; border: 1px solid gold; }
        button { padding: 12px 30px; font-size: 20px; cursor: pointer; background: #ffd600; border: none; border-radius: 10px; font-weight: bold; margin: 5px; }
      `}</style>
    </div>
  );
}
