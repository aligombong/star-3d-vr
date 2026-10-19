/**
 * GameHUD.tsx
 * Sleek, ergonomic game UI overlay adhering to Three.js collapsible bottom dock guidelines.
 * Displays live stats, game modes, Pico VR launch modal, and simulator controls.
 */

import React, { useState } from 'react';
import {
  Glasses,
  Volume2,
  VolumeX,
  Sparkles,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  Flame,
  Award,
  Zap,
} from 'lucide-react';
import { StarGameStats } from '../game/StarSimulation';

interface GameHUDProps {
  stats: StarGameStats;
  gameMode: 'zen' | 'chaser' | 'constellation';
  setGameMode: (mode: 'zen' | 'chaser' | 'constellation') => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onReset: () => void;
  onTriggerVortex: () => void;
  onEnterVR: () => void;
  isXRSupported: boolean;
  inXR: boolean;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  gameMode,
  setGameMode,
  isMuted,
  onToggleMute,
  onReset,
  onTriggerVortex,
  onEnterVR,
  isXRSupported,
  inXR,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [showPicoGuide, setShowPicoGuide] = useState(false);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
      {/* 1. Top Bar: Minimal Title Badge & Quick Status */}
      <header className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900/90 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-950/40">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-cinzel text-lg sm:text-xl font-bold tracking-wider text-slate-100 flex items-center gap-2">
              KIBASAN BINTANG
              <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                PICO WEBXR
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {inXR ? 'Mode VR Aktif (Pico VR Glasses)' : 'Ayunkan controller di VR atau seret kursor mouse untuk mengibaskan'}
            </p>
          </div>
        </div>

        {/* Top Right: VR Status & Audio Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPicoGuide(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700/60 transition-colors shadow-sm"
            title="Panduan Pico VR"
          >
            <Info className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Panduan Pico VR</span>
          </button>

          <button
            onClick={onToggleMute}
            className="w-9 h-9 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-700/60 transition-colors shadow-sm"
            title={isMuted ? 'Nyalakan Audio' : 'Bisukan Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* 2. Perimeter Status: Live Scoreboard (Low Occlusion, Top-Right) */}
      <div className="absolute top-20 right-4 sm:right-6 flex flex-col items-end gap-1.5 pointer-events-none">
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-2.5 shadow-xl text-right">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Skor Kosmik</div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight tabular-nums font-mono">
            {stats.score.toLocaleString()}
          </div>
          <div className="flex items-center justify-end gap-3 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-sky-400">
              <Sparkles className="w-3 h-3" />
              <strong className="tabular-nums font-semibold">{stats.starsDispersed}</strong> bintang
            </span>
            {stats.combo > 1 && (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Flame className="w-3.5 h-3.5" />
                <strong className="tabular-nums">{stats.combo}x</strong>
              </span>
            )}
          </div>
        </div>

        {stats.combo >= 5 && (
          <div className="px-3 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold animate-bounce flex items-center gap-1 shadow-lg">
            <Zap className="w-3 h-3 text-amber-400" />
            Kibasan Kosmik Beruntun!
          </div>
        )}
      </div>

      {/* 3. Unified Bottom Control Dock */}
      <div className="w-full flex flex-col items-center pointer-events-auto transition-transform duration-300 ease-out z-10">
        {/* Collapse / Expand Toggle Tab */}
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="mb-1.5 px-3 py-1 rounded-t-lg bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1.5 border-t border-x border-slate-700/60 shadow-md transition-colors"
        >
          {isDockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
              <span>Tampilkan Kontrol</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
              <span>Sembunyikan Kontrol (Mode Zen)</span>
            </>
          )}
        </button>

        {/* Main Dock Container */}
        <div
          className={`w-full max-w-3xl bg-slate-950/95 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-2xl transition-all duration-300 ${
            isDockCollapsed ? 'translate-y-32 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            {/* Mode Selector Tabs */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
              <button
                onClick={() => setGameMode('zen')}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  gameMode === 'zen'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Zen Kosmik
              </button>
              <button
                onClick={() => setGameMode('chaser')}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  gameMode === 'chaser'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pemburu Bintang
              </button>
              <button
                onClick={() => setGameMode('constellation')}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  gameMode === 'constellation'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Rasi Supernova
              </button>
            </div>

            {/* Action Buttons: Vortex & Reset */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={onTriggerVortex}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-sky-200 text-xs font-medium border border-sky-500/30 transition-all shadow-sm active:scale-95"
                title="Pusaran Badai Bintang"
              >
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                Pusaran Bintang
              </button>

              <button
                onClick={onReset}
                className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center border border-slate-800 transition-colors"
                title="Reset Permainan"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Big VR Button for Pico VR Glasses */}
              <button
                onClick={onEnterVR}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white text-xs font-bold tracking-wide uppercase shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95"
              >
                <Glasses className="w-4 h-4" />
                {inXR ? 'Keluar VR' : isXRSupported ? 'Masuk Pico VR' : 'Mulai WebXR'}
              </button>
            </div>
          </div>

          {/* Quick Subtext Hint */}
          <div className="mt-2.5 pt-2 border-t border-slate-900/80 flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>
              💡 <strong>Tips Pico:</strong> Buka di Pico Browser, klik tombol VR, lalu kibaskan controller untuk membelah bintang kosmik.
            </span>
            <span className="font-mono text-slate-400 hidden sm:inline">
              Max Combo: {stats.maxCombo}x
            </span>
          </div>
        </div>
      </div>

      {/* 4. Pico VR Glasses Guide Modal */}
      {showPicoGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 pointer-events-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Glasses className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-cinzel font-bold text-lg text-slate-100">Panduan Akses Pico VR</h3>
                <p className="text-xs text-slate-400">Pico 4 · Pico Neo 3 · Pico 4 Pro / Ultra</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center font-bold shrink-0">1</span>
                <p>Nyalakan kacamata Pico VR dan buka aplikasi <strong>Browser bawaan Pico</strong>.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center font-bold shrink-0">2</span>
                <p>Buka tautan website ini di browser kacamata Anda.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center font-bold shrink-0">3</span>
                <p>Tekan tombol <strong>"Masuk Pico VR"</strong> di layar bawah untuk meluncurkan sesi WebXR 6DOF.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center font-bold shrink-0">4</span>
                <p>
                  Kedua tangan Anda akan memegang tongkat kosmik bercahaya. <strong>Ayunkan dan kibaskan</strong> controller dengan kecepatan tinggi untuk menghamburkan ribuan bintang bertaburan dengan getaran haptik dan alunan audio kristal!
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPicoGuide(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
