import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Cloud, ContactShadows, Html, Float, Environment, MeshDistortMaterial, RoundedBox } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// --- GAME STATE ---
const useStore = create((set) => ({
  money: 50, day: 1, inventory: [], maxCapacity: 3, customersServed: 0, gameState: 'START',
  unlockedAnimals: ['chicken'], // chicken -> duck -> sheep -> cow
  unlockedCrops: ['carrot'],   // carrot -> tomato -> cabbage
  
  startDay: () => set({ gameState: 'PLAYING', customersServed: 0, inventory: [] }),
  addItem: (item) => set((s) => s.inventory.length < s.maxCapacity ? { inventory: [...s.inventory, item] } : s),
  serve: (itemType) => set((s) => {
    if (!s.inventory.includes(itemType)) return s;
    const rewards = { egg: 20, duck_egg: 35, sheep_milk: 60, cow_milk: 100, carrot: 25, tomato: 45, cabbage: 80 };
    const total = s.customersServed + 1;
    return { money: s.money + (rewards[itemType] || 20), customersServed: total, inventory: [], gameState: total >= 10 ? 'SHOP' : 'PLAYING' };
  }),
  buyUpgrade: (type, cost, nextItem) => set((s) => {
    if (s.money < cost) return s;
    if (type === 'animal') return { money: s.money - cost, unlockedAnimals: [...s.unlockedAnimals, nextItem] };
    if (type === 'crop') return { money: s.money - cost, unlockedCrops: [...s.unlockedCrops, nextItem] };
    return s;
  }),
  nextDay: () => set((s) => ({ day: s.day + 1, gameState: 'START' }))
}));

// --- STYLIZED CHARACTER ---
function ChibiCharacter({ color, position, isPlayer = false, holding = [] }) {
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
        move.normalize().multiplyScalar(7 * delta);
        group.current.position.add(move);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, Math.atan2(move.x, move.z), 0.15);
      }
      state.camera.position.lerp(new THREE.Vector3(group.current.position.x + 8, 12, group.current.position.z + 8), 0.1);
      state.camera.lookAt(group.current.position);
    }
    const animSpeed = moving ? 12 : 2;
    const amplitude = moving ? 0.6 : 0.05;
    lLeg.current.rotation.x = Math.sin(t * animSpeed) * amplitude;
    rLeg.current.rotation.x = Math.cos(t * animSpeed) * amplitude;
    body.current.position.y = 0.8 + Math.sin(t * animSpeed * 2) * 0.05;
  });

  return (
    <group ref={group} position={position}>
      <group ref={body}>
        <RoundedBox args={[0.7, 0.8, 0.6]} radius={0.15} castShadow><meshStandardMaterial color={color} /></RoundedBox>
        <mesh position={[0, 0.7, 0]} castShadow><sphereGeometry args={[0.35]} /><meshStandardMaterial color="#ffdbac" /></mesh>
        <mesh ref={lArm} position={[-0.45, 0, 0]}><capsuleGeometry args={[0.1, 0.3]} /><meshStandardMaterial color={color} /></mesh>
        <mesh ref={rArm} position={[0.45, 0, 0]}><capsuleGeometry args={[0.1, 0.3]} /><meshStandardMaterial color={color} /></mesh>
        {holding.map((item, i) => (
          <mesh key={i} position={[0, 0.2 + i * 0.25, 0.4]} castShadow>
            <sphereGeometry args={[0.12]} />
            <meshStandardMaterial color={item.includes('egg') ? "white" : item.includes('milk') ? "#e0f7fa" : "orange"} />
          </mesh>
        ))}
      </group>
      <mesh ref={lLeg} position={[-0.2, 0.2, 0]}><capsuleGeometry args={[0.1, 0.3]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh ref={rLeg} position={[0.2, 0.2, 0]}><capsuleGeometry args={[0.1, 0.3]} /><meshStandardMaterial color="#222" /></mesh>
    </group>
  );
}

// --- UPGRADABLE VEGETABLE PATCH ---
function VegetablePatch({ position }) {
  const { unlockedCrops, addItem } = useStore();
  const [stage, setStage] = useState('EMPTY');
  const [growth, setGrowth] = useState(0);
  const currentCrop = unlockedCrops[unlockedCrops.length - 1];

  const colors = { carrot: 'orange', tomato: 'red', cabbage: '#8bc34a' };

  useFrame((_, delta) => {
    if (stage === 'WATERED' && growth < 100) setGrowth(g => g + delta * 20);
    else if (growth >= 100) setStage('READY');
  });

  return (
    <group position={position} onClick={() => {
      if (stage === 'EMPTY') setStage('WATERED');
      else if (stage === 'READY') { addItem(currentCrop); setStage('EMPTY'); setGrowth(0); }
    }}>
      <RoundedBox args={[2.5, 0.2, 2.5]} radius={0.1}><meshStandardMaterial color="#4b3621" /></RoundedBox>
      {stage !== 'EMPTY' && (
        <Float speed={3} floatIntensity={0.3}>
          <mesh position={[0, growth/200, 0]}>
            <sphereGeometry args={[growth/200]} />
            <meshStandardMaterial color={colors[currentCrop]} />
          </mesh>
        </Float>
      )}
      <Html position={[0, 1.5, 0]}><div className="label">{stage === 'READY' ? `Harvest ${currentCrop}` : stage === 'WATERED' ? 'Growing...' : 'Water Seed'}</div></Html>
    </group>
  );
}

// --- UPGRADABLE ANIMAL COOP ---
function AnimalCoop({ position }) {
  const { unlockedAnimals, addItem } = useStore();
  const currentAnimal = unlockedAnimals[unlockedAnimals.length - 1];
  const produce = { chicken: 'egg', duck: 'duck_egg', sheep: 'sheep_milk', cow: 'cow_milk' };

  return (
    <group position={position} onClick={() => addItem(produce[currentAnimal])}>
      <RoundedBox args={[3, 2, 3]} radius={0.2} position={[0, 1, 0]} castShadow>
        <meshStandardMaterial color="#a1887f" />
      </RoundedBox>
      <mesh position={[0, 2.5, 0]} rotation={[0, 0, Math.PI/4]}>
        <boxGeometry args={[2.5, 2.5, 3.2]} />
        <meshStandardMaterial color="#b71c1c" />
      </mesh>
      <Html position={[0, 3.5, 0]}><div className="label">{currentAnimal.toUpperCase()} COOP</div></Html>
    </group>
  );
}

export default function App() {
  const s = useStore();
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#aed581' }}>
      <Canvas shadows camera={{ position: [12, 12, 12], fov: 35 }}>
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 40, 100]} />
          <Environment preset="forest" />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#7cb342" /></mesh>
          
          <AnimalCoop position={[-6, 0, 4]} />
          <VegetablePatch position={[6, 0, -4]} />

          <group position={[0, 0, -8]} onClick={() => s.serve(s.inventory[0])}>
            <ChibiCharacter color="#3f51b5" position={[0, 0, 0]} />
            <Html position={[0, 2.5, 0]}><div className="label">Next Order Please!</div></Html>
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
            <button onClick={s.startDay}>Begin Farming</button>
          </div>
        )}
        {s.gameState === 'SHOP' && (
          <div className="overlay shop">
            <h2>Farm Upgrades</h2>
            <button onClick={() => s.buyUpgrade('animal', 200, 'duck')} disabled={s.unlockedAnimals.includes('duck')}>Buy Duck (200g)</button>
            <button onClick={() => s.buyUpgrade('animal', 500, 'sheep')} disabled={s.unlockedAnimals.includes('sheep')}>Buy Sheep (500g)</button>
            <button onClick={() => s.buyUpgrade('crop', 150, 'tomato')} disabled={s.unlockedCrops.includes('tomato')}>Tomato Seeds (150g)</button>
            <button onClick={s.nextDay}>Sleep</button>
          </div>
        )}
      </div>

      <style>{`
        .hud { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; color: white; font-family: 'Patrick Hand', cursive; }
        .stats { padding: 20px; font-size: 28px; background: rgba(0,0,0,0.3); border-bottom-right-radius: 20px; display: inline-block; }
        .overlay { pointer-events: auto; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.85); padding: 40px; border-radius: 30px; text-align: center; border: 4px solid #ffd600; }
        .shop button { display: block; width: 100%; margin: 10px 0; }
        .label { background: rgba(0,0,0,0.6); padding: 5px 12px; border-radius: 10px; font-size: 14px; }
        button { padding: 12px 30px; font-size: 20px; cursor: pointer; background: #ffd600; border: none; border-radius: 10px; font-weight: bold; }
        button:disabled { opacity: 0.3; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
