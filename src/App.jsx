import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, ContactShadows, Html, Environment, MeshDistortMaterial, RoundedBox, Float } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// --- 1. DETAILED STATE MANAGEMENT ---
const useStore = create((set) => ({
  money: 300, day: 1, inventory: [], maxCapacity: 3, customersServed: 0, gameState: 'START',
  unlockedAnimals: ['chicken'], // chicken, duck, sheep, cow
  unlockedCrops: ['carrot'],   // carrot, tomato, cabbage
  
  startDay: () => set({ gameState: 'PLAYING', customersServed: 0, inventory: [] }),
  addItem: (item) => set((s) => s.inventory.length < s.maxCapacity ? { inventory: [...s.inventory, item] } : s),
  serve: (itemNeeded) => set((s) => {
    if (!s.inventory.includes(itemNeeded)) return s;
    const rewards = { egg: 20, duck_egg: 45, sheep_milk: 80, carrot: 30, tomato: 55 };
    const total = s.customersServed + 1;
    // Remove only one instance of the item
    const idx = s.inventory.indexOf(itemNeeded);
    const newInv = [...s.inventory];
    newInv.splice(idx, 1);

    return { 
      money: s.money + (rewards[itemNeeded] || 20), 
      customersServed: total, 
      inventory: newInv, 
      gameState: total >= 10 ? 'SHOP' : 'PLAYING' 
    };
  }),
  buyUpgrade: (type, cost, nextItem) => set((s) => {
    if (s.money < cost) return s;
    const key = type === 'animal' ? 'unlockedAnimals' : 'unlockedCrops';
    return { money: s.money - cost, [key]: [...s[key], nextItem] };
  }),
  nextDay: () => set((s) => ({ day: s.day + 1, gameState: 'START' }))
}));

// --- 2. DETAILED PLANT MODELS ---
function Crop({ type, growth }) {
  const isReady = growth >= 100;
  const size = (growth / 100) * 0.4;
  
  return (
    <group scale={isReady ? 1.2 : 1}>
      {/* Root/Fruit */}
      <mesh position={[0, size, 0]}>
        {type === 'carrot' && <coneGeometry args={[0.15, 0.4, 8]} />}
        {type === 'tomato' && <sphereGeometry args={[0.2, 16, 16]} />}
        <meshStandardMaterial color={type === 'carrot' ? 'orange' : 'red'} />
      </mesh>
      {/* Leaves */}
      <mesh position={[0, size * 1.5, 0]} rotation={[0, 0.5, 0.2]}>
        <boxGeometry args={[0.1, 0.3, 0.05]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      <mesh position={[0, size * 1.5, 0]} rotation={[0, -0.5, -0.2]}>
        <boxGeometry args={[0.1, 0.3, 0.05]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
    </group>
  );
}

// --- 3. DYNAMIC ANIMAL SPAWNER ---
function AnimalStation({ type, position, color, label, produce }) {
  const addItem = useStore(s => s.addItem);
  return (
    <group position={position} onClick={() => addItem(produce)}>
      <RoundedBox args={[2, 1, 2]} radius={0.1} castShadow>
        <meshStandardMaterial color={color} />
      </RoundedBox>
      <Html position={[0, 1.5, 0]} center><div className="label">{label}</div></Html>
      {/* Visual representation of the animal */}
      <Float speed={2} floatIntensity={0.5}>
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[0.3]} />
          <meshStandardMaterial color={type === 'chicken' ? 'white' : type === 'duck' ? 'yellow' : 'lightgray'} />
        </mesh>
      </Float>
    </group>
  );
}

// --- 4. CHARACTER & ANIMATION ---
function ChibiCharacter({ color, position, isPlayer = false, orderItem = null, inventory = [] }) {
  const group = useRef();
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
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, Math.atan2(move.x, move.z), 0.1);
      }
      state.camera.position.lerp(new THREE.Vector3(group.current.position.x + 10, 12, group.current.position.z + 10), 0.1);
      state.camera.lookAt(group.current.position);
    }
    const t = state.clock.elapsedTime;
    lLeg.current.rotation.x = Math.sin(t * 10) * 0.5;
    rLeg.current.rotation.x = Math.cos(t * 10) * 0.5;
  });

  return (
    <group ref={group} position={position}>
      <RoundedBox args={[0.6, 0.8, 0.5]} radius={0.1} position={[0, 0.6, 0]} castShadow><meshStandardMaterial color={color} /></RoundedBox>
      <mesh position={[0, 1.3, 0]} castShadow><sphereGeometry args={[0.3]} /><meshStandardMaterial color="#ffdbac" /></mesh>
      
      {orderItem && (
        <Html position={[0, 2.2, 0]} center>
          <div className="order-bubble">
            {orderItem === 'egg' && '⚪'} {orderItem === 'duck_egg' && '🟡'} {orderItem === 'carrot' && '🥕'} {orderItem === 'tomato' && '🍅'}
            <div style={{fontSize: '10px'}}>{orderItem.replace('_', ' ')}</div>
          </div>
        </Html>
      )}

      {/* Visual Inventory */}
      <group position={[0, 0.5, 0.4]}>
        {inventory.map((item, i) => (
          <mesh key={i} position={[0, i * 0.2, 0]}><sphereGeometry args={[0.1]} /><meshStandardMaterial color={item.includes('egg') ? 'white' : 'orange'} /></mesh>
        ))}
      </group>

      <mesh ref={lLeg} position={[-0.2, 0.2, 0]}><capsuleGeometry args={[0.08, 0.3]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh ref={rLeg} position={[0.2, 0.2, 0]}><capsuleGeometry args={[0.08, 0.3]} /><meshStandardMaterial color="#111" /></mesh>
    </group>
  );
}

// --- MAIN APP ---
export default function App() {
  const s = useStore();
  const [growth, setGrowth] = useState({ carrot: 0, tomato: 0 });
  const [stages, setStages] = useState({ carrot: 'EMPTY', tomato: 'EMPTY' });

  useFrame((_, delta) => {
    Object.keys(stages).forEach(crop => {
      if (stages[crop] === 'GROWING' && growth[crop] < 100) {
        setGrowth(prev => ({ ...prev, [crop]: prev[crop] + delta * 20 }));
      } else if (growth[crop] >= 100) {
        setStages(prev => ({ ...prev, [crop]: 'READY' }));
      }
    });
  });

  const getOrder = () => {
    const pool = [...s.unlockedAnimals.map(a => a === 'chicken' ? 'egg' : 'duck_egg'), ...s.unlockedCrops];
    return pool[s.customersServed % pool.length];
  }

  return (
    <div className="game-screen">
      <Canvas shadows camera={{ position: [12, 12, 12], fov: 35 }}>
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="forest" />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
          
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#1b5e20" />
          </mesh>

          {/* Animals */}
          <AnimalStation type="chicken" position={[-6, 0, 4]} color="#a1887f" label="Chicken" produce="egg" />
          {s.unlockedAnimals.includes('duck') && (
            <AnimalStation type="duck" position={[-6, 0, 8]} color="#4db6ac" label="Duck" produce="duck_egg" />
          )}

          {/* Crops */}
          <group position={[6, 0, -4]} onClick={() => {
            if (stages.carrot === 'EMPTY') setStages(s => ({...s, carrot: 'GROWING'}));
            else if (stages.carrot === 'READY') { s.addItem('carrot'); setStages(s => ({...s, carrot: 'EMPTY'})); setGrowth(g => ({...g, carrot: 0})); }
          }}>
            <RoundedBox args={[2, 0.2, 2]} radius={0.05}><meshStandardMaterial color="#3e2723" /></RoundedBox>
            {stages.carrot !== 'EMPTY' && <Crop type="carrot" growth={growth.carrot} />}
            <Html position={[0, 1.2, 0]} center><div className="label">Carrot Patch</div></Html>
          </group>

          {s.unlockedCrops.includes('tomato') && (
            <group position={[6, 0, 0]} onClick={() => {
              if (stages.tomato === 'EMPTY') setStages(s => ({...s, tomato: 'GROWING'}));
              else if (stages.tomato === 'READY') { s.addItem('tomato'); setStages(s => ({...s, tomato: 'EMPTY'})); setGrowth(g => ({...g, tomato: 0})); }
            }}>
              <RoundedBox args={[2, 0.2, 2]} radius={0.05}><meshStandardMaterial color="#3e2723" /></RoundedBox>
              {stages.tomato !== 'EMPTY' && <Crop type="tomato" growth={growth.tomato} />}
              <Html position={[0, 1.2, 0]} center><div className="label">Tomato Patch</div></Html>
            </group>
          )}

          {/* Queue */}
          <group position={[0, 0, -8]}>
            <mesh position={[0, 0.5, 0]}><boxGeometry args={[4, 1, 2]} /><meshStandardMaterial color="#5d4037" /></mesh>
            <ChibiCharacter color="#3f51b5" position={[0, 0.6, 2.5]} orderItem={getOrder()} />
            <mesh onClick={() => s.serve(getOrder())} position={[0, 1.5, 1.5]} visible={false}><boxGeometry args={[2,2,2]} /></mesh>
          </group>

          <ChibiCharacter color="#ffd600" isPlayer position={[0, 0, 0]} inventory={s.inventory} />
          <ContactShadows opacity={0.4} scale={40} blur={2.5} />
        </Suspense>
      </Canvas>

      <div className="hud">
        <div className="stats">💰 {s.money}g | 📅 Day {s.day} | 📦 {s.inventory.length}/{s.maxCapacity}</div>
        {s.gameState === 'START' && (
          <div className="overlay"><h1>Day {s.day}</h1><button onClick={s.startDay}>Start Day</button></div>
        )}
        {s.gameState === 'SHOP' && (
          <div className="overlay shop">
            <h2>Upgrades</h2>
            {!s.unlockedAnimals.includes('duck') && <button onClick={() => s.buyUpgrade('animal', 200, 'duck')}>Unlock Duck (200g)</button>}
            {!s.unlockedCrops.includes('tomato') && <button onClick={() => s.buyUpgrade('crop', 150, 'tomato')}>Tomato Seeds (150g)</button>}
            <button onClick={s.nextDay}>Next Day</button>
          </div>
        )}
      </div>

      <style>{`
        .game-screen { width: 100vw; height: 100vh; background: radial-gradient(circle, #2e7d32 0%, #1b5e20 100%); }
        .hud { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; color: white; font-family: sans-serif; }
        .stats { padding: 20px; font-size: 24px; background: rgba(0,0,0,0.5); border-bottom-right-radius: 20px; display: inline-block; }
        .overlay { pointer-events: auto; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); padding: 50px; border-radius: 30px; text-align: center; border: 2px solid gold; }
        .order-bubble { background: white; color: black; padding: 8px; border-radius: 12px; border: 2px solid #3f51b5; font-weight: bold; text-align: center; min-width: 60px; }
        .label { background: rgba(0,0,0,0.7); padding: 4px 10px; border-radius: 8px; font-size: 12px; border: 1px solid #ffd600; white-space: nowrap; }
        button { padding: 12px 24px; font-size: 18px; cursor: pointer; background: #ffd600; border: none; border-radius: 8px; font-weight: bold; margin: 10px; }
        button:disabled { opacity: 0.3; }
      `}</style>
    </div>
  );
}
