import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Cloud, ContactShadows, Html, Float, Environment } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

// --- 1. GAME LOGIC (STATE STORE) ---
const useStore = create((set) => ({
  money: 0,
  day: 1,
  inventory: [],
  maxCapacity: 3,
  customersServed: 0,
  gameState: 'START', // START, PLAYING, SHOP
  
  startDay: () => set({ gameState: 'PLAYING', customersServed: 0, inventory: [] }),
  addItem: (item) => set((state) => {
    if (state.inventory.length < state.maxCapacity) return { inventory: [...state.inventory, item] };
    return state;
  }),
  serve: (itemType) => set((state) => {
    const hasItem = state.inventory.includes(itemType);
    if (!hasItem) return state;

    const reward = itemType === 'egg' ? 15 : 40;
    const totalServed = state.customersServed + 1;
    return {
      money: state.money + reward,
      customersServed: totalServed,
      inventory: [], // Delivery empties hands
      gameState: totalServed >= 10 ? 'SHOP' : 'PLAYING'
    };
  }),
  upgrade: (cost) => set((state) => ({ 
    money: state.money - cost, 
    maxCapacity: state.maxCapacity + 2 
  })),
  nextDay: () => set((state) => ({ day: state.day + 1, gameState: 'START' }))
}));

// --- 2. PLAYER CONTROLLER (WASD) ---
function Player() {
  const mesh = useRef();
  const [keys, setKeys] = useState({});

  useEffect(() => {
    const down = (e) => setKeys(k => ({ ...k, [e.code]: true }));
    const up = (e) => setKeys(k => ({ ...k, [e.code]: false }));
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    const speed = 6;
    let move = new THREE.Vector3(0, 0, 0);
    if (keys.KeyW || keys.ArrowUp) move.z -= 1;
    if (keys.KeyS || keys.ArrowDown) move.z += 1;
    if (keys.KeyA || keys.ArrowLeft) move.x -= 1;
    if (keys.KeyD || keys.ArrowRight) move.x += 1;
    
    if (move.length() > 0) {
      move.normalize().multiplyScalar(speed * delta);
      mesh.current.position.add(move);
      mesh.current.rotation.y = Math.atan2(move.x, move.z);
    }
    // Smooth Camera Follow
    state.camera.position.lerp(new THREE.Vector3(mesh.current.position.x + 8, 10, mesh.current.position.z + 8), 0.1);
    state.camera.lookAt(mesh.current.position);
  });

  return (
    <mesh ref={mesh} castShadow position={[0, 0.5, 0]}>
      <capsuleGeometry args={[0.4, 0.6, 4, 8]} />
      <meshStandardMaterial color="#ffcc00" />
    </mesh>
  );
}

// --- 3. VEGETABLE GARDEN COMPONENT ---
function VegetablePatch() {
  const [stage, setStage] = useState('EMPTY'); // EMPTY, WATERED, READY
  const [growth, setGrowth] = useState(0);
  const addItem = useStore(s => s.addItem);

  useFrame((state, delta) => {
    if (stage === 'WATERED') {
      if (growth < 100) setGrowth(prev => prev + delta * 15);
      else setStage('READY');
    }
  });

  const handleClick = () => {
    if (stage === 'EMPTY') setStage('WATERED');
    else if (stage === 'READY') {
      addItem('veggie');
      setStage('EMPTY');
      setGrowth(0);
    }
  };

  return (
    <group position={[5, 0, -5]} onClick={handleClick}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2, 2]} />
        <meshStandardMaterial color={stage === 'EMPTY' ? "#4b3621" : "#2d1e12"} />
      </mesh>
      {stage !== 'EMPTY' && (
        <mesh position={[0, growth / 200, 0]} castShadow>
          <coneGeometry args={[0.2, growth / 100, 8]} />
          <meshStandardMaterial color={stage === 'READY' ? "orange" : "green"} />
        </mesh>
      )}
      <Html position={[0, 1.2, 0]}>
        <div className="label">{stage === 'EMPTY' ? "💧 Water" : stage === 'READY' ? "🥕 Harvest" : `🌱 ${Math.round(growth)}%`}</div>
      </Html>
    </group>
  );
}

// --- 4. MAIN WORLD ---
function FarmWorld() {
  const { addItem, serve, inventory, customersServed, gameState } = useStore();
  const sunPos = [20, 20, 20];

  return (
    <>
      <Sky sunPosition={sunPos} />
      <Environment preset="forest" />
      <ambientLight intensity={0.6} />
      <directionalLight position={sunPos} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#567d46" />
      </mesh>

      {/* Chicken Coop */}
      <group position={[-5, 0, 2]} onClick={() => addItem('egg')}>
        <mesh castShadow position={[0, 0.75, 0]}><boxGeometry args={[2, 1.5, 2]} /><meshStandardMaterial color="#8d6e63" /></mesh>
        <Html position={[0, 2, 0]}><div className="label">🐔 Chickens (Egg)</div></Html>
      </group>

      <VegetablePatch />

      {/* Customer / Counter */}
      <group position={[0, 0, -8]} onClick={() => serve(customersServed % 2 === 0 ? 'egg' : 'veggie')}>
        <mesh castShadow position={[0, 1, 0]}><cylinderGeometry args={[0.8, 0.8, 2]} /><meshStandardMaterial color="#3f51b5" /></mesh>
        <Html position={[0, 2.5, 0]}>
          <div className="label">
            👤 Customer {customersServed + 1}/10<br/>
            Order: {customersServed % 2 === 0 ? '🥚 Egg' : '🥕 Veggie'}
          </div>
        </Html>
      </group>

      <ContactShadows opacity={0.4} scale={30} blur={2.5} far={10} />
      <Float speed={1.5} rotationIntensity={0.5}><Cloud position={[-15, 12, -10]} opacity={0.4} /></Float>
    </>
  );
}

// --- 5. MAIN APP UI ---
export default function App() {
  const s = useStore();

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#87ceeb' }}>
      <Canvas shadows camera={{ position: [10, 10, 10], fov: 40 }}>
        <Suspense fallback={null}>
          <FarmWorld />
          {s.gameState === 'PLAYING' && <Player />}
        </Suspense>
      </Canvas>

      <div className="hud">
        <div className="stats">
          💰 {s.money}g | 📅 Day {s.day} | 📦 {s.inventory.length}/{s.maxCapacity} Items
        </div>
        
        {s.gameState === 'START' && (
          <div className="overlay">
            <h1>Rustic Harvest 3D</h1>
            <p>Use WASD to move. Click objects to farm!</p>
            <button onClick={s.startDay}>Begin Day {s.day}</button>
          </div>
        )}

        {s.gameState === 'SHOP' && (
          <div className="overlay">
            <h1>Day Cleared!</h1>
            <p>You served 10 customers.</p>
            <button onClick={() => s.upgrade(100)} disabled={s.money < 100}>Upgrade Basket (100g)</button>
            <button onClick={s.nextDay}>Rest for Tomorrow</button>
          </div>
        )}
      </div>

      <style>{`
        .hud { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; color: white; font-family: 'Segoe UI', sans-serif; }
        .stats { padding: 20px; font-size: 22px; font-weight: bold; background: rgba(0,0,0,0.3); display: inline-block; border-bottom-right-radius: 20px; }
        .overlay { pointer-events: auto; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.85); padding: 50px; border-radius: 30px; text-align: center; border: 4px solid #ffcc00; }
        .label { background: rgba(0,0,0,0.7); padding: 6px 12px; border-radius: 8px; white-space: nowrap; pointer-events: none; font-size: 14px; text-align: center; }
        button { padding: 15px 30px; font-size: 20px; cursor: pointer; background: #ffcc00; border: none; border-radius: 10px; margin: 10px; font-weight: bold; transition: 0.2s; }
        button:hover { background: #fff; transform: scale(1.05); }
        button:disabled { background: #555; cursor: not-allowed; opacity: 0.5; }
      `}</style>
    </div>
  );
}
