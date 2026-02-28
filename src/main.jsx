import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, ContactShadows, Html, Environment, Float, MeshDistortMaterial } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// --- 1. GAME DATA ---
const useStore = create((set) => ({
  money: 50, day: 1, inventory: [], maxCapacity: 3, customersServed: 0, gameState: 'START',
  unlockedAnimals: ['chicken'], unlockedCrops: ['carrot'],
  startDay: () => set({ gameState: 'PLAYING', customersServed: 0, inventory: [] }),
  addItem: (item) => set((s) => s.inventory.length < s.maxCapacity ? { inventory: [...s.inventory, item] } : s),
  serve: (item) => set((s) => {
    if (!s.inventory.includes(item)) return s;
    const rewards = { egg: 25, duck_egg: 50, carrot: 30, tomato: 60 };
    const newInv = [...s.inventory]; newInv.splice(s.inventory.indexOf(item), 1);
    const total = s.customersServed + 1;
    return { money: s.money + (rewards[item] || 20), customersServed: total, inventory: newInv, gameState: total >= 10 ? 'SHOP' : 'PLAYING' };
  }),
  buyUpgrade: (type, cost, next) => set((s) => {
    if (s.money < cost) return s;
    const key = type === 'animal' ? 'unlockedAnimals' : 'unlockedCrops';
    return { money: s.money - cost, [key]: [...s[key], next] };
  }),
  nextDay: () => set((s) => ({ day: s.day + 1, gameState: 'START' }))
}));

// --- 2. AESTHETIC MODELS ---
function AestheticTree({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.2, 0.4, 2]} /><meshStandardMaterial color="#3e2723" /></mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <sphereGeometry args={[1.3, 16, 16]} />
        <MeshDistortMaterial color="#1b5e20" speed={2} distort={0.2} radius={1} />
      </mesh>
    </group>
  );
}

function ChibiCharacter({ color, position, isPlayer, order, inventory = [] }) {
  const group = useRef();
  const [keys, setKeys] = useState({});
  useEffect(() => {
    if (!isPlayer) return;
    const h = (e, v) => setKeys(k => ({ ...k, [e.code]: v }));
    window.addEventListener('keydown', (e) => h(e, true));
    window.addEventListener('keyup', (e) => h(e, false));
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('keyup', h); };
  }, [isPlayer]);

  useFrame((state, delta) => {
    if (isPlayer && group.current) {
      const move = new THREE.Vector3(0,0,0);
      if (keys.KeyW || keys.ArrowUp) move.z -= 1; if (keys.KeyS || keys.ArrowDown) move.z += 1;
      if (keys.KeyA || keys.ArrowLeft) move.x -= 1; if (keys.KeyD || keys.ArrowRight) move.x += 1;
      if (move.length() > 0) {
        move.normalize().multiplyScalar(8 * delta);
        group.current.position.add(move);
        group.current.rotation.y = Math.atan2(move.x, move.z);
      }
      state.camera.position.lerp(new THREE.Vector3(group.current.position.x + 10, 10, group.current.position.z + 10), 0.1);
      state.camera.lookAt(group.current.position);
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[0.7, 0.8, 0.5]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 1.3, 0]}><sphereGeometry args={[0.35, 12, 12]} /><meshStandardMaterial color="#ffdbac" /></mesh>
      {order && (
        <Html position={[0, 2.3, 0]} center>
          <div className="bubble">WANT: {order.toUpperCase()}</div>
        </Html>
      )}
      {inventory.map((item, i) => (
        <mesh key={i} position={[0, 0.4 + i * 0.2, 0.4]}><sphereGeometry args={[0.1]} /><meshStandardMaterial color="white" /></mesh>
      ))}
    </group>
  );
}

// --- 3. MAIN GAME ---
function App() {
  const s = useStore();
  const [growth, setGrowth] = useState({ carrot: 0, tomato: 0 });
  const [stages, setStages] = useState({ carrot: 'EMPTY', tomato: 'EMPTY' });

  useFrame((_, delta) => {
    ['carrot', 'tomato'].forEach(c => {
      if (stages[c] === 'GROWING' && growth[c] < 100) setGrowth(g => ({...g, [c]: g[c] + delta * 20}));
      else if (growth[c] >= 100) setStages(st => ({...st, [c]: 'READY'}));
    });
  });

  const order = s.customersServed % 2 === 0 ? (s.unlockedAnimals.includes('duck') ? 'duck_egg' : 'egg') : (s.unlockedCrops.includes('tomato') ? 'tomato' : 'carrot');

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a210f' }}>
      <Canvas shadows camera={{ position: [15, 15, 15] }}>
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="forest" />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
          
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#1b5e20" />
          </mesh>

          <AestheticTree position={[-10, 0, -10]} /><AestheticTree position={[10, 0, -10]} />

          {/* Chicken/Duck Station */}
          <group position={[-6, 0, 4]} onClick={() => s.addItem(s.unlockedAnimals.includes('duck') ? 'duck_egg' : 'egg')}>
            <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[2, 1, 2]} /><meshStandardMaterial color="#5d4037" /></mesh>
            <Html position={[0, 1.2, 0]} center><div className="label">COOP</div></Html>
          </group>

          {/* Carrot/Tomato Patches */}
          <group position={[6, 0, -4]} onClick={() => {
            if (stages.carrot === 'EMPTY') setStages(p => ({...p, carrot: 'GROWING'}));
            else if (stages.carrot === 'READY') { s.addItem('carrot'); setStages(p => ({...p, carrot: 'EMPTY'})); setGrowth(g => ({...g, carrot: 0})); }
          }}>
            <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,2]} /><meshStandardMaterial color="#3e2723" /></mesh>
            {stages.carrot !== 'EMPTY' && (
              <mesh position={[0, growth.carrot/200, 0]}><coneGeometry args={[0.1, 0.4]} /><meshStandardMaterial color="orange" /></mesh>
            )}
            <Html position={[0, 1, 0]} center><div className="label">CARROTS</div></Html>
          </group>

          {s.unlockedCrops.includes('tomato') && (
            <group position={[6, 0, 0]} onClick={() => {
              if (stages.tomato === 'EMPTY') setStages(p => ({...p, tomato: 'GROWING'}));
              else if (stages.tomato === 'READY') { s.addItem('tomato'); setStages(p => ({...p, tomato: 'EMPTY'})); setGrowth(g => ({...g, tomato: 0})); }
            }}>
              <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2.5,2.5]} /><meshStandardMaterial color="#3e2723" /></mesh>
              {stages.tomato !== 'EMPTY' && (
                <mesh position={[0, growth.tomato/200, 0]}><sphereGeometry args={[0.15]} /><meshStandardMaterial color="red" /></mesh>
              )}
              <Html position={[0, 1, 0]} center><div className="label">TOMATOES</div></Html>
            </group>
          )}

          {/* Counter/Customer */}
          <group position={[0, 0, -8]} onClick={() => s.serve(order)}>
            <mesh position={[0, 0.5, 0]}><boxGeometry args={[4, 1, 2]} /><meshStandardMaterial color="#4e342e" /></mesh>
            <ChibiCharacter color="#3f51b5" position={[0, 0, 2]} order={order} />
          </group>

          {s.gameState === 'PLAYING' && <ChibiCharacter color="#ffd600" isPlayer position={[0, 0, 0]} inventory={s.inventory} />}
          <ContactShadows opacity={0.5} scale={30} blur={2.5} />
        </Suspense>
      </Canvas>

      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none', fontFamily: 'sans-serif' }}>
        <h1 style={{margin:0}}>💰 {s.money}g</h1>
        <p>Day {s.day} | Bag: {s.inventory.length}/3</p>
      </div>

      {s.gameState === 'START' && (
        <div className="overlay">
          <h1>HARVEST VALLEY</h1>
          <button className="btn" onClick={s.startDay}>START DAY</button>
        </div>
      )}

      {s.gameState === 'SHOP' && (
        <div className="overlay">
          <h1>MARKET CLOSED</h1>
          {!s.unlockedAnimals.includes('duck') && <button className="btn" onClick={() => s.buyUpgrade('animal', 200, 'duck')}>UNLOCK DUCK (200g)</button>}
          {!s.unlockedCrops.includes('tomato') && <button className="btn" onClick={() => s.buyUpgrade('crop', 150, 'tomato')}>TOMATO SEEDS (150g)</button>}
          <button className="btn" style={{marginTop: '20px'}} onClick={s.nextDay}>SLEEP</button>
        </div>
      )}

      <style>{`
        .overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; }
        .btn { padding: 15px 30px; font-size: 20px; background: #ffd600; border: none; cursor: pointer; font-weight: bold; margin: 10px; border-radius: 10px; }
        .label { background: rgba(0,0,0,0.8); color: white; padding: 2px 8px; font-size: 10px; border: 1px solid gold; white-space: nowrap; }
        .bubble { background: white; color: black; padding: 10px; border-radius: 10px; border: 3px solid blue; font-weight: bold; font-family: sans-serif; }
      `}</style>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
