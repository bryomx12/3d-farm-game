import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, ContactShadows, Html, Environment, MeshDistortMaterial, RoundedBox, Float } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// --- 1. STATE ---
const useStore = create((set) => ({
  money: 300, day: 1, inventory: [], maxCapacity: 3, customersServed: 0, gameState: 'START',
  unlockedAnimals: ['chicken'], 
  unlockedCrops: ['carrot'],
  
  startDay: () => set({ gameState: 'PLAYING', customersServed: 0, inventory: [] }),
  addItem: (item) => set((s) => s.inventory.length < s.maxCapacity ? { inventory: [...s.inventory, item] } : s),
  serve: (itemNeeded) => set((s) => {
    if (!s.inventory.includes(itemNeeded)) return s;
    const rewards = { egg: 25, duck_egg: 50, tomato: 60, carrot: 35 };
    const idx = s.inventory.indexOf(itemNeeded);
    const newInv = [...s.inventory];
    newInv.splice(idx, 1);
    const total = s.customersServed + 1;
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

// --- 2. MODELS ---
function ForestTree({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.2, 0.4, 2]} /><meshStandardMaterial color="#2b1d0e" /></mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <sphereGeometry args={[1.3, 16, 16]} />
        <MeshDistortMaterial color="#004d40" speed={2} distort={0.2} radius={1} />
      </mesh>
    </group>
  );
}

function Crop({ type, growth }) {
  const size = (growth / 100);
  return (
    <group position={[0, 0.1, 0]} scale={size}>
      <mesh position={[0, 0.2, 0]} castShadow>
        {type === 'carrot' ? <coneGeometry args={[0.15, 0.5, 8]} /> : <sphereGeometry args={[0.2, 16, 16]} />}
        <meshStandardMaterial color={type === 'carrot' ? "orange" : "red"} />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.05, 0.3, 0.15]} />
        <meshStandardMaterial color="green" />
      </mesh>
    </group>
  );
}

function ChibiCharacter({ color, position, isPlayer = false, orderItem = null, inventory = [] }) {
  const group = useRef();
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
  });

  return (
    <group ref={group} position={position}>
      <RoundedBox args={[0.6, 0.8, 0.5]} radius={0.1} position={[0, 0.6, 0]} castShadow><meshStandardMaterial color={color} /></RoundedBox>
      <mesh position={[0, 1.3, 0]} castShadow><sphereGeometry args={[0.3]} /><meshStandardMaterial color="#ffdbac" /></mesh>
      {orderItem && (
        <Html position={[0, 2.2, 0]} center>
          <div className="order-bubble">
            <div style={{fontSize: '20px'}}>{orderItem === 'egg' ? '🥚' : orderItem === 'duck_egg' ? '🟡' : orderItem === 'carrot' ? '🥕' : '🍅'}</div>
            <div style={{fontSize: '10px', color: 'black'}}>{orderItem.toUpperCase()}</div>
          </div>
        </Html>
      )}
      <group position={[0, 0.6, 0.4]}>
        {inventory.map((item, i) => (
          <mesh key={i} position={[0, i * 0.22, 0]}><sphereGeometry args={[0.1]} /><meshStandardMaterial color={item.includes('egg') ? "white" : "orange"} /></mesh>
        ))}
      </group>
    </group>
  );
}

// --- 3. MAIN ---
export default function App() {
  const s = useStore();
  const [growth, setGrowth] = useState({ carrot: 0, tomato: 0 });
  const [stages, setStages] = useState({ carrot: 'EMPTY', tomato: 'EMPTY' });

  useFrame((_, delta) => {
    ['carrot', 'tomato'].forEach(crop => {
      if (stages[crop] === 'GROWING' && growth[crop] < 100) {
        setGrowth(prev => ({ ...prev, [crop]: prev[crop] + delta * 20 }));
      } else if (growth[crop] >= 100 && stages[crop] !== 'READY') {
        setStages(prev => ({ ...prev, [crop]: 'READY' }));
      }
    });
  });

  const getOrder = () => {
    const pool = [...s.unlockedAnimals.map(a => a === 'chicken' ? 'egg' : 'duck_egg'), ...s.unlockedCrops];
    return pool[s.customersServed % pool.length];
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#002e1a' }}>
      <Canvas shadows camera={{ position: [15, 15, 15], fov: 35 }}>
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="forest" />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
          
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#1b5e20" roughness={0.8} />
          </mesh>

          {/* Scenery */}
          <ForestTree position={[-10, 0, -10]} /><ForestTree position={[10, 0, -10]} /><ForestTree position={[-12, 0, 10]} />

          {/* Animal Stations */}
          <group position={[-6, 0, 4]} onClick={() => s.addItem('egg')}>
            <RoundedBox args={[2, 1, 2]} radius={0.1}><meshStandardMaterial color="#5d4037" /></RoundedBox>
            <Html position={[0, 1.5, 0]} center><div className="label">CHICKEN</div></Html>
            <Float><mesh position={[0, 0.8, 0]}><sphereGeometry args={[0.3]} /><meshStandardMaterial color="white" /></mesh></Float>
          </group>

          {s.unlockedAnimals.includes('duck') && (
            <group position={[-6, 0, 8]} onClick={() => s.addItem('duck_egg')}>
              <RoundedBox args={[2, 1, 2]} radius={0.1}><meshStandardMaterial color="#00695c" /></RoundedBox>
              <Html position={[0, 1.5, 0]} center><div className="label">DUCK</div></Html>
              <Float><mesh position={[0, 0.8, 0]}><sphereGeometry args={[0.3]} /><meshStandardMaterial color="yellow" /></mesh></Float>
            </group>
          )}

          {/* Crops */}
          <group position={[6, 0, -4]} onClick={() => {
            if (stages.carrot === 'EMPTY') setStages(p => ({...p, carrot: 'GROWING'}));
            else if (stages.carrot === 'READY') { s.addItem('carrot'); setStages(p => ({...p, carrot: 'EMPTY'})); setGrowth(g => ({...g, carrot: 0})); }
          }}>
            <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,2]} /><meshStandardMaterial color="#3e2723" /></mesh>
            {stages.carrot !== 'EMPTY' && <Crop type="carrot" growth={growth.carrot} />}
            <Html position={[0, 1, 0]} center><div className="label">CARROTS</div></Html>
          </group>

          {s.unlockedCrops.includes('tomato') && (
            <group position={[6, 0, 0]} onClick={() => {
              if (stages.tomato === 'EMPTY') setStages(p => ({...p, tomato: 'GROWING'}));
              else if (stages.tomato === 'READY') { s.addItem('tomato'); setStages(p => ({...p, tomato: 'EMPTY'})); setGrowth(g => ({...g, tomato: 0})); }
            }}>
              <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,2]} /><meshStandardMaterial color="#3e2723" /></mesh>
              {stages.tomato !== 'EMPTY' && <Crop type="tomato" growth={growth.tomato} />}
              <Html position={[0, 1, 0]} center><div className="label">TOMATOES</div></Html>
            </group>
          )}

          {/* Counter/Queue */}
          <group position={[0, 0, -8]}>
            <mesh position={[0, 0.5, 0]}><boxGeometry args={[4, 1, 2]} /><meshStandardMaterial color="#4e342e" /></mesh>
            <ChibiCharacter color="#3f51b5" position={[0, 0, 2]} orderItem={getOrder()} />
            <mesh position={[0, 1.5, 2]} onClick={() => s.serve(getOrder())} visible={false}><boxGeometry args={[2,2,2]} /></mesh>
          </group>

          <ChibiCharacter color="#ffd600" isPlayer position={[0, 0, 0]} inventory={s.inventory} />
          <ContactShadows opacity={0.5} scale={30} blur={2.5} />
        </Suspense>
      </Canvas>

      <div className="hud">
        <div className="stats">💰 {s.money}g | 📅 Day {s.day} | 📦 {s.inventory.length}/{s.maxCapacity}</div>
        {s.gameState === 'START' && (
          <div className="overlay"><h1>Rustic Harvest</h1><button onClick={s.startDay}>Begin Day</button></div>
        )}
        {s.gameState === 'SHOP' && (
          <div className="overlay shop">
            <h2>End of Day</h2>
            {!s.unlockedAnimals.includes('duck') && <button onClick={() => s.buyUpgrade('animal', 200, 'duck')}>Unlock Duck (200g)</button>}
            {!s.unlockedCrops.includes('tomato') && <button onClick={() => s.buyUpgrade('crop', 150, 'tomato')}>Tomato Seeds (150g)</button>}
            <button onClick={s.nextDay}>Next Day</button>
          </div>
        )}
      </div>

      <style>{`
        .hud { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; color: white; font-family: sans-serif; }
        .stats { padding: 20px; font-size: 24px; font-weight: bold; background: rgba(0,0,0,0.4); border-bottom-right-radius: 20px; display: inline-block; }
        .overlay { pointer-events: auto; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); padding: 40px; border-radius: 20px; text-align: center; border: 2px solid gold; }
        .order-bubble { background: white; padding: 10px; border-radius: 12px; border: 3px solid #3f51b5; text-align: center; min-width: 80px; }
        .label { background: rgba(0,0,0,0.8); padding: 4px 10px; border-radius: 8px; font-size: 11px; border: 1px solid #ffd600; white-space: nowrap; font-weight: bold; }
        button { padding: 12px 24px; font-size: 18px; cursor: pointer; background: #ffd600; border: none; border-radius: 8px; font-weight: bold; margin: 10px; }
      `}</style>
    </div>
  );
}
