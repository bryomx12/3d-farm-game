import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, ContactShadows, Html, Environment } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// --- STORE ---
const useStore = create((set) => ({
  money: 300, day: 1, inventory: [], maxCapacity: 3, customersServed: 0, gameState: 'START',
  unlockedAnimals: ['chicken'], unlockedCrops: ['carrot'],
  startDay: () => set({ gameState: 'PLAYING', customersServed: 0, inventory: [] }),
  addItem: (item) => set((s) => s.inventory.length < s.maxCapacity ? { inventory: [...s.inventory, item] } : s),
  serve: (itemNeeded) => set((s) => {
    if (!s.inventory.includes(itemNeeded)) return s;
    const rewards = { egg: 25, duck_egg: 50, tomato: 60, carrot: 35 };
    const idx = s.inventory.indexOf(itemNeeded);
    const newInv = [...s.inventory];
    newInv.splice(idx, 1);
    const total = s.customersServed + 1;
    return { money: s.money + (rewards[itemNeeded] || 20), customersServed: total, inventory: newInv, gameState: total >= 10 ? 'SHOP' : 'PLAYING' };
  }),
  buyUpgrade: (type, cost, nextItem) => set((s) => {
    if (s.money < cost) return s;
    const key = type === 'animal' ? 'unlockedAnimals' : 'unlockedCrops';
    return { money: s.money - cost, [key]: [...s[key], nextItem] };
  }),
  nextDay: () => set((state) => ({ day: state.day + 1, gameState: 'START' }))
}));

// --- MODELS ---
function Plant({ type, growth }) {
  const size = growth / 100;
  return (
    <group scale={size} position={[0, 0.1, 0]}>
      <mesh position={[0, 0.2, 0]}>
        {type === 'carrot' ? <coneGeometry args={[0.15, 0.5, 6]} /> : <sphereGeometry args={[0.2, 8, 8]} />}
        <meshStandardMaterial color={type === 'carrot' ? "orange" : "red"} />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.05, 0.3, 0.1]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
    </group>
  );
}

function Character({ color, position, isPlayer, order, inventory = [] }) {
  const group = useRef();
  const [keys, setKeys] = useState({});
  useEffect(() => {
    if (!isPlayer) return;
    const handleKeys = (e, val) => setKeys(k => ({ ...k, [e.code]: val }));
    window.addEventListener('keydown', (e) => handleKeys(e, true));
    window.addEventListener('keyup', (e) => handleKeys(e, false));
    return () => { window.removeEventListener('keydown', handleKeys); window.removeEventListener('keyup', handleKeys); };
  }, [isPlayer]);

  useFrame((state, delta) => {
    if (isPlayer && group.current) {
      const move = new THREE.Vector3(0,0,0);
      if (keys.KeyW) move.z -= 1; if (keys.KeyS) move.z += 1;
      if (keys.KeyA) move.x -= 1; if (keys.KeyD) move.x += 1;
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
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.6, 0.8, 0.5]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      {order && (
        <Html position={[0, 2.2, 0]} center>
          <div style={{ background: 'white', color: 'black', padding: '5px', borderRadius: '5px', border: '2px solid blue', fontWeight: 'bold' }}>
            {order.toUpperCase()}
          </div>
        </Html>
      )}
      {inventory.map((item, i) => (
        <mesh key={i} position={[0, 0.8 + i * 0.2, 0.4]}>
          <sphereGeometry args={[0.1, 4, 4]} />
          <meshStandardMaterial color={item.includes('egg') ? 'white' : 'orange'} />
        </mesh>
      ))}
    </group>
  );
}

// --- MAIN APP ---
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

  const currentOrder = s.customersServed % 2 === 0 ? (s.unlockedAnimals.includes('duck') ? 'duck_egg' : 'egg') : (s.unlockedCrops.includes('tomato') ? 'tomato' : 'carrot');

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

          {/* Stations */}
          <group position={[-5, 0, 4]} onClick={() => s.addItem('egg')}>
            <mesh position={[0, 0.5, 0]}><boxGeometry args={[2, 1, 2]} /><meshStandardMaterial color="#5d4037" /></mesh>
            <Html position={[0, 1.2, 0]} center><div style={{color: 'white', fontSize: '10px'}}>CHICKEN</div></Html>
          </group>

          {s.unlockedAnimals.includes('duck') && (
            <group position={[-5, 0, 8]} onClick={() => s.addItem('duck_egg')}>
              <mesh position={[0, 0.5, 0]}><boxGeometry args={[2, 1, 2]} /><meshStandardMaterial color="#00695c" /></mesh>
              <Html position={[0, 1.2, 0]} center><div style={{color: 'white', fontSize: '10px'}}>DUCK</div></Html>
            </group>
          )}

          <group position={[5, 0, -4]} onClick={() => {
            if (stages.carrot === 'EMPTY') setStages(p => ({...p, carrot: 'GROWING'}));
            else if (stages.carrot === 'READY') { s.addItem('carrot'); setStages(p => ({...p, carrot: 'EMPTY'})); setGrowth(g => ({...g, carrot: 0})); }
          }}>
            <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,2]} /><meshStandardMaterial color="#3e2723" /></mesh>
            {stages.carrot !== 'EMPTY' && <Plant type="carrot" growth={growth.carrot} />}
          </group>

          {s.unlockedCrops.includes('tomato') && (
            <group position={[5, 0, 0]} onClick={() => {
              if (stages.tomato === 'EMPTY') setStages(p => ({...p, tomato: 'GROWING'}));
              else if (stages.tomato === 'READY') { s.addItem('tomato'); setStages(p => ({...p, tomato: 'EMPTY'})); setGrowth(g => ({...g, tomato: 0})); }
            }}>
              <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,2]} /><meshStandardMaterial color="#3e2723" /></mesh>
              {stages.tomato !== 'EMPTY' && <Plant type="tomato" growth={growth.tomato} />}
            </group>
          )}

          <group position={[0, 0, -8]} onClick={() => s.serve(currentOrder)}>
            <mesh position={[0, 0.5, 0]}><boxGeometry args={[4, 1, 2]} /><meshStandardMaterial color="#4e342e" /></mesh>
            <Character color="#3f51b5" position={[0, 0, 2]} order={currentOrder} />
          </group>

          {s.gameState === 'PLAYING' && <Character color="#ffd600" isPlayer position={[0, 0, 0]} inventory={s.inventory} />}
          <ContactShadows opacity={0.5} scale={30} blur={2} />
        </Suspense>
      </Canvas>

      {/* UI */}
      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none' }}>
        <h2 style={{margin: 0}}>💰 {s.money}g</h2>
        <p>Day {s.day} | Bag: {s.inventory.length}/{s.maxCapacity}</p>
      </div>

      {s.gameState === 'START' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', pointerEvents: 'all' }}>
          <h1>Rustic Harvest</h1>
          <button onClick={s.startDay} style={{ padding: '15px 30px', fontSize: '20px', background: 'gold', border: 'none', cursor: 'pointer' }}>Begin Day</button>
        </div>
      )}

      {s.gameState === 'SHOP' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', pointerEvents: 'all' }}>
          <h2>Day Ended</h2>
          {!s.unlockedAnimals.includes('duck') && <button onClick={() => s.buyUpgrade('animal', 200, 'duck')}>Unlock Duck (200g)</button>}
          {!s.unlockedCrops.includes('tomato') && <button onClick={() => s.buyUpgrade('crop', 150, 'tomato')}>Tomato Seeds (150g)</button>}
          <button onClick={s.nextDay} style={{marginTop: '20px'}}>Sleep</button>
        </div>
      )}
    </div>
  );
}
