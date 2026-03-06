/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, Play, BarChart2, Check, X, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { cn } from './utils';

// --- Types ---

type Shape = 'circle' | 'square' | 'triangle' | 'cross' | 'L' | 'T';
type Color = '#FF5F5F' | '#5F7FFF' | '#5FFF7F' | '#FFCF5F' | '#CF5FFF';

interface Stimulus {
  id: string;
  shape: Shape;
  color: Color;
  rotation: number;
  size: number;
  x: number;
  y: number;
}

interface Trial {
  id: string;
  timestamp: number;
  difficulty: number;
  target: Stimulus;
  distractors: Stimulus[];
  responseTime?: number;
  correct?: boolean;
  zScore?: number;
  isDiagnostic?: boolean;
}

interface SessionStats {
  accuracy: number;
  avgRT: number;
  trials: Trial[];
  fatigueDetectedAt?: number;
}

// --- Constants ---

const SESSION_DURATION = 45; // seconds
const DIAGNOSTIC_TRIALS_COUNT = 10;
const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'cross'];
const COLORS: Color[] = ['#FF5F5F', '#5F7FFF', '#5FFF7F', '#FFCF5F', '#CF5FFF'];
const SIMILAR_SHAPES: Record<string, Shape[]> = {
  'L': ['T'],
  'T': ['L'],
};

// --- Utils ---

const generateId = () => Math.random().toString(36).substring(2, 9);

const calculateStats = (trials: Trial[]) => {
  const correctTrials = trials.filter(t => t.correct && t.responseTime);
  if (correctTrials.length === 0) return { mean: 1500, stdDev: 500 };

  const rts = correctTrials.map(t => t.responseTime!);
  const mean = rts.reduce((a, b) => a + b, 0) / rts.length;
  const variance = rts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rts.length;
  const stdDev = Math.sqrt(variance) || 100; // avoid zero

  return { mean, stdDev };
};

const getZScore = (rt: number, mean: number, stdDev: number) => {
  return (rt - mean) / stdDev;
};

// --- Components ---

interface StimulusProps {
  stimulus: Stimulus;
  onClick?: () => void;
  key?: string | number;
}

const StimulusComponent = ({ stimulus, onClick }: StimulusProps) => {
  const size = stimulus.size;
  const color = stimulus.color;

  const renderShape = () => {
    switch (stimulus.shape) {
      case 'circle':
        return <div style={{ width: size, height: size, backgroundColor: color, borderRadius: '50%' }} />;
      case 'square':
        return <div style={{ width: size, height: size, backgroundColor: color }} />;
      case 'triangle':
        return (
          <div 
            style={{ 
              width: 0, 
              height: 0, 
              borderLeft: `${size / 2}px solid transparent`,
              borderRight: `${size / 2}px solid transparent`,
              borderBottom: `${size}px solid ${color}` 
            }} 
          />
        );
      case 'cross':
        return (
          <div className="relative" style={{ width: size, height: size }}>
            <div className="absolute inset-0 m-auto" style={{ width: '30%', height: '100%', backgroundColor: color }} />
            <div className="absolute inset-0 m-auto" style={{ width: '100%', height: '30%', backgroundColor: color }} />
          </div>
        );
      case 'L':
        return (
          <div className="relative" style={{ width: size, height: size }}>
            <div className="absolute left-0 top-0" style={{ width: '25%', height: '100%', backgroundColor: color }} />
            <div className="absolute left-0 bottom-0" style={{ width: '100%', height: '25%', backgroundColor: color }} />
          </div>
        );
      case 'T':
        return (
          <div className="relative" style={{ width: size, height: size }}>
            <div className="absolute left-0 top-0" style={{ width: '100%', height: '25%', backgroundColor: color }} />
            <div className="absolute inset-x-0 top-0 m-auto" style={{ width: '25%', height: '100%', backgroundColor: color }} />
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="absolute cursor-pointer flex items-center justify-center"
      style={{ 
        left: `${stimulus.x}%`, 
        top: `${stimulus.y}%`, 
        transform: `translate(-50%, -50%) rotate(${stimulus.rotation}deg)`,
        width: size + 20,
        height: size + 20
      }}
    >
      {renderShape()}
    </motion.div>
  );
};

export default function App() {
  const [view, setView] = useState<'menu' | 'intro' | 'countdown' | 'playing' | 'results' | 'stats' | 'settings' | 'help'>('menu');
  const [history, setHistory] = useState<Trial[]>(() => {
    const saved = localStorage.getItem('infocus_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSession, setCurrentSession] = useState<Trial[]>([]);
  const [currentTrial, setCurrentTrial] = useState<Trial | null>(null);
  const [difficulty, setDifficulty] = useState(1);
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    localStorage.setItem('infocus_history', JSON.stringify(history));
  }, [history]);

  const playBeep = (freq: number, duration: number) => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, audioCtx.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.current.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.current.currentTime + duration);
  };

  const generateTrial = (level: number, isDiagnostic: boolean = false): Trial => {
    const targetShape = level >= 8 ? (Math.random() > 0.5 ? 'L' : 'T') : SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const targetColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const targetRotation = level >= 3 ? Math.floor(Math.random() * 4) * 90 : 0;
    
    const numDistractors = 5 + level * 3;
    const distractors: Stimulus[] = [];
    const positions: { x: number; y: number }[] = [];

    const isPositionValid = (x: number, y: number) => {
      return !positions.some(p => Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2)) < 12);
    };

    const getValidPosition = () => {
      let x, y, attempts = 0;
      do {
        x = 10 + Math.random() * 80;
        y = 15 + Math.random() * 70;
        attempts++;
      } while (!isPositionValid(x, y) && attempts < 100);
      return { x, y };
    };

    const targetPos = getValidPosition();
    positions.push(targetPos);
    const target: Stimulus = {
      id: 'target',
      shape: targetShape,
      color: targetColor,
      rotation: targetRotation,
      size: 40,
      x: targetPos.x,
      y: targetPos.y
    };

    // Define distractor types outside the loop to ensure they are not all unique
    let distractorTypes: { shape: Shape; color: Color; rotation: number }[] = [];

    if (level < 4) {
      // Low load: All distractors are identical, differing by one feature
      let feature = Math.floor(Math.random() * 3);
      
      // If the shape is rotationally invariant (circle, square, cross at 90deg), 
      // don't use rotation as the only difference.
      const isInvariant = targetShape === 'circle' || targetShape === 'square' || targetShape === 'cross';
      if (feature === 2 && isInvariant) {
        feature = Math.random() > 0.5 ? 0 : 1; // Fallback to shape or color
      }

      const dShape = feature === 0 ? (SHAPES.find(s => s !== targetShape) || SHAPES[0]) : targetShape;
      const dColor = feature === 1 ? (COLORS.find(c => c !== targetColor) || COLORS[0]) : targetColor;
      const dRotation = feature === 2 ? (targetRotation + 90) % 360 : targetRotation;
      distractorTypes = [{ shape: dShape, color: dColor, rotation: dRotation }];
    } else if (level < 8) {
      // Moderate load: Two types of distractors (Conjunction Search)
      // Target shares one feature with each group
      const otherShape = SHAPES.find(s => s !== targetShape) || SHAPES[0];
      const otherColor = COLORS.find(c => c !== targetColor) || COLORS[0];
      
      distractorTypes = [
        { shape: targetShape, color: otherColor, rotation: targetRotation },
        { shape: otherShape, color: targetColor, rotation: targetRotation }
      ];
    } else {
      // High load: All distractors are identical and very similar
      const dShape = SIMILAR_SHAPES[targetShape]?.[0] || targetShape;
      distractorTypes = [{ shape: dShape, color: targetColor, rotation: targetRotation }];
    }

    for (let i = 0; i < numDistractors; i++) {
      const type = distractorTypes[i % distractorTypes.length];
      const pos = getValidPosition();
      positions.push(pos);
      distractors.push({
        id: `d-${i}`,
        ...type,
        size: 40,
        x: pos.x,
        y: pos.y
      });
    }

    return {
      id: generateId(),
      timestamp: Date.now(),
      difficulty: level,
      target,
      distractors,
      isDiagnostic
    };
  };

  const startSession = () => {
    const hasHistory = history.length >= DIAGNOSTIC_TRIALS_COUNT;
    setCurrentSession([]);
    setDifficulty(hasHistory ? history[history.length - 1].difficulty : 1);
    setTimeLeft(SESSION_DURATION);
    setView('intro');
  };

  const handleCountdown = () => {
    setView('countdown');
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          playBeep(880, 0.3);
          setTimeout(() => {
            setView('playing');
            nextTrial();
          }, 500);
          return 0;
        }
        playBeep(440, 0.1);
        return prev - 1;
      });
    }, 1000);
    playBeep(440, 0.1);
  };

  const nextTrial = () => {
    const isDiagnostic = history.length + currentSession.length < DIAGNOSTIC_TRIALS_COUNT;
    const trial = generateTrial(difficulty, isDiagnostic);
    setCurrentTrial(trial);
    setFeedback(null);
  };

  const handleResponse = (correct: boolean) => {
    if (!currentTrial) return;
    const rt = Date.now() - currentTrial.timestamp;
    
    // Stats calculation
    const { mean, stdDev } = calculateStats([...history, ...currentSession]);
    const z = getZScore(rt, mean, stdDev);

    const completedTrial: Trial = {
      ...currentTrial,
      responseTime: rt,
      correct,
      zScore: z
    };

    setCurrentSession(prev => [...prev, completedTrial]);
    setFeedback(correct ? 'correct' : 'incorrect');

    // Adaptive logic
    setTimeout(() => {
      if (timeLeft > 0) {
        let nextDiff = difficulty;
        
        // Decision Logic
        if (correct) {
          if (z < 0.5) nextDiff = Math.min(10, difficulty + 1);
          else if (z <= 1.5) nextDiff = difficulty;
        } else {
          // Check for fatigue in last 5 trials
          const last5 = [...currentSession, completedTrial].slice(-5);
          const fatigueDetected = last5.filter(t => t.zScore! > 1.5).length >= 2 || z > 1.5;
          
          if (fatigueDetected) nextDiff = Math.max(1, difficulty - 1);
          else nextDiff = difficulty; // Maintain for consistency check
        }
        
        setDifficulty(nextDiff);
        nextTrial();
      } else {
        finishSession([...currentSession, completedTrial]);
      }
    }, 600);
  };

  const finishSession = (session: Trial[]) => {
    setHistory(prev => [...prev, ...session]);
    setView('results');
  };

  useEffect(() => {
    if (view === 'playing' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && view === 'playing') {
      finishSession(currentSession);
    }
  }, [view, timeLeft]);

  const globalStats = useMemo(() => {
    const hasData = history.length > 0;
    const { mean } = calculateStats(history);
    const accuracy = hasData ? (history.filter(t => t.correct).length / history.length) * 100 : 0;
    
    // Group by session for chart
    const sessionData = history.reduce((acc: any[], trial, idx) => {
      const sessionIdx = Math.floor(idx / 20); // rough approximation
      if (!acc[sessionIdx]) acc[sessionIdx] = { name: `S${sessionIdx + 1}`, diff: 0, count: 0 };
      acc[sessionIdx].diff += trial.difficulty;
      acc[sessionIdx].count++;
      return acc;
    }, []).map(s => ({ ...s, diff: s.diff / s.count }));

    return { mean: hasData ? mean : 0, accuracy, sessionData, hasData };
  }, [history]);

  const currentSessionStats = useMemo(() => {
    if (currentSession.length === 0) return null;
    const accuracy = (currentSession.filter(t => t.correct).length / currentSession.length) * 100;
    const avgRT = currentSession.filter(t => t.correct).reduce((a, b) => a + b.responseTime!, 0) / currentSession.filter(t => t.correct).length;
    const fatigueIdx = currentSession.findIndex(t => t.zScore! > 1.5);
    
    return {
      accuracy,
      avgRT,
      fatigueDetectedAt: fatigueIdx !== -1 ? fatigueIdx : undefined,
      chartData: currentSession.map((t, i) => ({ name: i + 1, diff: t.difficulty, fatigue: t.zScore! > 1.5 ? t.difficulty : null }))
    };
  }, [currentSession]);

  return (
    <div className="min-h-screen bg-brand text-white overflow-hidden relative selection:bg-white/30 font-sans">
      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-screen p-6"
          >
            <div className="absolute top-8 left-8">
              <button onClick={() => setView('settings')} className="p-2 hover:bg-white/10 rounded-full transition-colors"><Settings size={28} strokeWidth={1.5} /></button>
            </div>
            <div className="absolute top-8 right-8">
              <button onClick={() => setView('help')} className="p-2 hover:bg-white/10 rounded-full transition-colors w-11 h-11 flex items-center justify-center"><span className="text-3xl font-display font-light">?</span></button>
            </div>
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.8 }} className="mb-16 text-center">
              <h1 className="text-6xl md:text-8xl font-display font-light tracking-[0.2em]">IN-FOCUS</h1>
            </motion.div>
            <div className="flex flex-col gap-6 w-full max-w-xs">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startSession} className="bg-white text-brand py-4 px-8 rounded-full font-semibold text-lg shadow-sm flex items-center justify-center gap-2"><Play size={20} fill="currentColor" />INICIAR</motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setView('stats')} className="bg-brand text-white border-2 border-white/30 py-4 px-8 rounded-full font-semibold text-lg flex items-center justify-center gap-2"><BarChart2 size={20} />ESTADÍSTICAS</motion.button>
            </div>
          </motion.div>
        )}

        {view === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center min-h-screen p-8 text-center" onClick={handleCountdown}>
            <h2 className="text-5xl font-display mb-6">¿Estás lista?</h2>
            <p className="text-xl mb-12 max-w-md font-light">¡Encuentra la figura diferente lo más rápido que puedas sin equivocarte!</p>
            <p className="text-sm opacity-60 animate-pulse mt-12">Presiona para continuar</p>
          </motion.div>
        )}

        {view === 'countdown' && (
          <motion.div key="countdown" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.5 }} className="flex items-center justify-center min-h-screen">
            <span className="text-9xl font-display font-bold">{countdown > 0 ? countdown : '¡Ya!'}</span>
          </motion.div>
        )}

        {view === 'playing' && currentTrial && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full h-screen bg-white/5">
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-8 z-10 bg-black/20 px-6 py-2 rounded-full backdrop-blur-md">
              <div className="text-2xl font-mono font-bold w-12 text-center">{timeLeft}s</div>
              <div className="h-4 w-32 bg-white/20 rounded-full overflow-hidden">
                <motion.div className="h-full bg-white" initial={{ width: 0 }} animate={{ width: `${(difficulty / 10) * 100}%` }} />
              </div>
              <div className="text-sm font-semibold opacity-80 uppercase tracking-widest">Nivel {difficulty}</div>
            </div>

            <div className="relative w-full h-full max-w-5xl mx-auto">
              {currentTrial.distractors.map(d => (
                <StimulusComponent key={d.id} stimulus={d} onClick={() => handleResponse(false)} />
              ))}
              <StimulusComponent stimulus={currentTrial.target} onClick={() => handleResponse(true)} />
            </div>

            <AnimatePresence>
              {feedback && (
                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  {feedback === 'correct' ? <div className="bg-emerald-500 p-8 rounded-full shadow-2xl"><Check size={80} strokeWidth={3} /></div> : <div className="bg-rose-500 p-8 rounded-full shadow-2xl"><X size={80} strokeWidth={3} /></div>}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {view === 'results' && currentSessionStats && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen p-8 flex flex-col items-center justify-center max-w-4xl mx-auto">
            <h2 className="text-4xl font-display mb-12">Sesión Finalizada</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-12">
              <div className="bg-white/10 p-8 rounded-3xl backdrop-blur-sm">
                <p className="text-sm uppercase tracking-widest opacity-60 mb-2">Precisión</p>
                <p className="text-5xl font-display font-bold">{currentSessionStats.accuracy.toFixed(1)}%</p>
              </div>
              <div className="bg-white/10 p-8 rounded-3xl backdrop-blur-sm">
                <p className="text-sm uppercase tracking-widest opacity-60 mb-2">Tiempo de Respuesta</p>
                <p className="text-5xl font-display font-bold">{(currentSessionStats.avgRT / 1000).toFixed(2)}s</p>
              </div>
            </div>
            
            <div className="w-full h-64 bg-white/5 p-6 rounded-3xl mb-12">
              <p className="text-sm uppercase tracking-widest opacity-60 mb-4">Progreso de Carga Cognitiva</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currentSessionStats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="name" hide />
                  <YAxis domain={[0, 10]} hide />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '12px' }} />
                  <Line type="monotone" dataKey="diff" stroke="#fff" strokeWidth={3} dot={false} />
                  {currentSessionStats.fatigueDetectedAt !== undefined && (
                    <Line type="monotone" dataKey="fatigue" stroke="#FF5F5F" strokeWidth={0} dot={{ r: 6, fill: '#FF5F5F' }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
              {currentSessionStats.fatigueDetectedAt !== undefined && (
                <p className="text-xs text-rose-400 mt-4 text-center">● Fatiga cognitiva detectada durante la sesión</p>
              )}
            </div>

            <button onClick={() => setView('menu')} className="bg-white text-brand py-4 px-12 rounded-full font-bold text-lg">CONTINUAR</button>
          </motion.div>
        )}

        {view === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen p-8 max-w-5xl mx-auto">
            <div className="flex items-center gap-6 mb-12">
              <button onClick={() => setView('menu')} className="p-3 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft size={24} /></button>
              <h2 className="text-4xl font-display">Estadísticas Globales</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white/10 p-8 rounded-3xl">
                <p className="text-sm uppercase tracking-widest opacity-60 mb-2">RT Promedio Global</p>
                <p className="text-5xl font-display font-bold">
                  {globalStats.hasData ? (globalStats.mean / 1000).toFixed(2) : "0.00"}s
                </p>
              </div>
              <div className="bg-white/10 p-8 rounded-3xl">
                <p className="text-sm uppercase tracking-widest opacity-60 mb-2">Precisión Histórica</p>
                <p className="text-5xl font-display font-bold">
                  {globalStats.accuracy.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="w-full h-80 bg-white/5 p-8 rounded-3xl">
              <p className="text-sm uppercase tracking-widest opacity-60 mb-6">Evolución de Dificultad</p>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={globalStats.sessionData}>
                  <defs>
                    <linearGradient id="colorDiff" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                  <YAxis domain={[0, 10]} stroke="rgba(255,255,255,0.4)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="diff" stroke="#fff" fillOpacity={1} fill="url(#colorDiff)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {(view === 'settings' || view === 'help') && (
          <motion.div key="modal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="min-h-screen p-8 flex flex-col items-center justify-center max-w-2xl mx-auto text-center">
            <h2 className="text-4xl font-display mb-8 capitalize">{view === 'help' ? 'Ayuda' : 'Ajustes'}</h2>
            <div className="bg-white/10 p-8 rounded-3xl mb-12 text-left w-full">
              {view === 'help' ? (
                <div className="space-y-4 font-light leading-relaxed">
                  <p><strong>IN-FOCUS</strong> utiliza tareas de búsqueda visual para entrenar tu atención selectiva.</p>
                  <p>El sistema ajusta la dificultad en tiempo real analizando tu tiempo de respuesta y precisión mediante puntuaciones Z.</p>
                  <p>Si detectamos fatiga cognitiva (variabilidad inusual), la carga disminuirá para mantenerte en tu zona óptima de rendimiento.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span>Borrar Historial</span>
                    {!showResetConfirm ? (
                      <button 
                        onClick={() => setShowResetConfirm(true)} 
                        className="bg-rose-500/20 text-rose-400 px-4 py-2 rounded-full text-sm font-bold hover:bg-rose-500/30 transition-colors"
                      >
                        RESETEAR
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setHistory([]);
                            setCurrentSession([]);
                            setDifficulty(1);
                            localStorage.removeItem('infocus_history');
                            setShowResetConfirm(false);
                            setView('menu');
                          }} 
                          className="bg-rose-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg"
                        >
                          SÍ, BORRAR
                        </button>
                        <button 
                          onClick={() => setShowResetConfirm(false)} 
                          className="bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold"
                        >
                          NO
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center opacity-50">
                    <span>Efectos de Sonido</span>
                    <div className="w-12 h-6 bg-white/20 rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" /></div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => { setView('menu'); setShowResetConfirm(false); }} className="bg-white text-brand py-4 px-12 rounded-full font-bold">VOLVER</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
