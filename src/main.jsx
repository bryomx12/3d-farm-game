import React, { useState, useRef, useEffect, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, ContactShadows, Html, Environment } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// --- 1. GAME DATA ---
const useStore = create((set) => ({
  money: 100, day: 1, inventory: [], maxCapacity: 3, customersServed: 0, gameState: 'START',
  unlockedAnimals: ['chicken'], unlockedCrops: ['carrot'],
  startDay: () => set({ gameState: 'PLAYING', customersServed: 0, inventory: [] }),
  addItem: (item) => set((s) => s.inventory.length < s.maxCapacity ? { inventory: [...s.inventory, item] } : s),
  serve: (item) => set((s) => {
    if (!s.inventory.includes(item)) return s;
    const rewards = { egg: 25, duck_egg: 50, carrot: 35, tomato: 60 };
    const newInv = [...s.inventory];
    newInv.splice(s.inventory.indexOf(item), 1);
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

// --- 2. MODELS ---
function Plant({ type, growth }) {
  const size = growth / 100;
  return (
    <group scale={size} position={[0, 0.1, 0]}>
      <mesh position={[0, 0.2, 0]}>
        {type === 'carrot' ? <coneGeometry args={[0.15, 0.5, 6]} /> : <sphereGeometry args={[0.2, 8, 8]} />}
        <meshStandardMaterial color={type === 'carrot' ? "orange" : "red"} />
      </mesh>
      {/* Green Leaves */}
      <mesh position={[0, 0.4, 0]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.05, 0.3, 0.15]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
    </group>
  );
}

function Chibi({ color, position, isPlayer, order, inventory = [] }) {
  const group = useRef();
  const lLeg = useRef();
  const rLeg = useRef();
  const [keys, setKeys] = useState({});

  useEffect(() => {
    if (!isPlayer) return;
    const h = (e, v) => setKeys(k => ({ ...k, [e.code]: v }));
    window.addEventListener('keydown', (e) => h(e, true));
    window.addEventListener('keyup', (e) => h(e, false));
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('keyup', h); };
  }, [isPlayer]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    let moving = false;
    if (isPlayer && group.current) {
      const move = new THREE.Vector3(0,0,0);
      if (keys.KeyW || keys.ArrowUp) move.z -= 1; if (keys.KeyS || keys.ArrowDown) move.z += 1;
      if (keys.KeyA || keys.ArrowLeft) move.x -= 1; if (keys.KeyD || keys.ArrowRight) move.x += 1;
      if (move.length() > 0) {
        moving = true;
        move.normalize().multiplyScalar(8 * delta);
        group.current.position.add(move);
        group.current.rotation.y = Math.atan2(move.x, move.z);
      }
      state.camera.position.lerp(new THREE.Vector3(group.current.position.x + 10, 10, group.current.position.z + 10), 0.1);
      state.camera.lookAt(group.current.position);
    }
    const speed = moving ? 12 : 2;
    lLeg.current.rotation.x = Math.sin(t * speed) * 0.5;
    rLeg.current.rotation.x = Math.cos(t * speed) * 0.5;
  });

  return (
    <group ref={group} position={position}>
      {/* Body & Head */}
      <mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[0.7, 0.8, 0.5]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 1.4, 0]}><sphereGeometry args={[0.35, 12, 12]} /><meshStandardMaterial color="#ffdbac" /></mesh>
      {/* Feet */}
      <mesh ref={lLeg} position={[-0.2, 0.2, 0]}><boxGeometry args={[0.15, 0.3, 0.15]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh ref={rLeg} position={[0.2, 0.2, 0]}><boxGeometry args={[0.15, 0.3, 0.15]} /><meshStandardMaterial color="#111" /></mesh>
      {/* Order UI */}
      {order && (
        <Html position={[0, 2.5, 0]} center>
          <div style={{background:'white', color:'black', padding:'8px', borderRadius:'10px', border:'2px solid blue', fontWeight:'bold', textAlign:'center', minWidth:'80px'}}>
            {order.toUpperCase()}
          </div>
        </Html>
      )}
      {/* Hand Items */}
      {inventory.map((item, i) => (
        <mesh key={i} position={[0, 0.8 + i * 0.2, 0.4]}><sphereGeometry args={[0.1]} /><meshStandardMaterial color="white" /></mesh>
      ))}
    </group>
  );
}

// --- 3. MAIN GAME COMPONENT ---
function Game() {
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
        <Suspense fallback={<Html center>Loading Farm...</Html>}>
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="forest" />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
          
          {/* Emerald Grass */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#1b5e20" />
          </mesh>

          {/* Chicken Station */}
          <group position={[-6, 0, 4]} onClick={() => s.addItem('egg')}>
            <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[2, 1, 2]} /><meshStandardMaterial color="#5d4037" /></mesh>
            <Html position={[0, 1.2, 0]} center><div style={{background:'black', color:'white', padding:'2px 8px', fontSize:'10px'}}>CHICKEN</div></Html>
          </group>

          {/* Carrot Patch */}
          <group position={[6, 0, -4]} onClick={() => {
            if (stages.carrot === 'EMPTY') setStages(p => ({...p, carrot: 'GROWING'}));
            else if (stages.carrot === 'READY') { s.addItem('carrot'); setStages(p => ({...p, carrot: 'EMPTY'})); setGrowth(g => ({...g, carrot: 0})); }
          }}>
            <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2.5,2.5]} /><meshStandardMaterial color="#3e2723" /></mesh>
            {stages.carrot !== 'EMPTY' && <Plant type="carrot" growth={growth.carrot} />}
          </group>

          {/* Counter/Customer Line */}
          <group position={[0, 0, -8]} onClick={() => s.serve(order)}>
            <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[4, 1, 2]} /><meshStandardMaterial color="#4e342e" /></mesh>
            <Chibi color="#3f51b5" position={[0, 0, 2]} order={order} />
          </group>

          {s.gameState === 'PLAYING' && <Chibi color="#ffd600" isPlayer position={[0, 0, 0]} inventory={s.inventory} />}
          <ContactShadows opacity={0.5} scale={30} blur={2.5} />
        </Suspense>
      </Canvas>

      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none', fontFamily: 'sans-serif' }}>
        <h1 style={{margin:0}}>💰 {s.money}g</h1>
        <p>Day {s.day} | Bag: {s.inventory.length}/3</p>
      </div>

      {s.gameState !== 'PLAYING' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', zIndex: 10 }}>
          <h1 style={{fontSize:'48px', color:'gold'}}>RUSTIC HARVEST</h1>
          {s.gameState === 'SHOP' && (
            <div style={{marginBottom:'20px'}}>
              {!s.unlockedAnimals.includes('duck') && <button className="btn" onClick={() => s.buyUpgrade('animal', 200, 'duck')}>Unlock Duck (200g)</button>}
              {!s.unlockedCrops.includes('tomato') && <button className="btn" onClick={() => s.buyUpgrade('crop', 150, 'tomato')}>Tomato Seeds (150g)</button>}
            </div>
          )}
          <button className="btn" onClick={s.gameState === 'START' ? s.startDay : s.nextDay}>
            {s.gameState === 'START' ? 'START GAME' : 'SLEEP'}
          </button>
        </div>
      )}

      <style>{`
        .btn { padding: 15px 30px; font-size: 20px; background: #ffd600; border: none; cursor: pointer; font-weight: bold; margin: 10px; border-radius: 10px; pointer-events: all; color: black; }
        .btn:hover { background: white; }
      `}</style>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Game />);
