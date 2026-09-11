import React from 'react';
import { 
  Sparkles, 
  Target, 
  Award, 
  Clock, 
  Flame, 
  BookOpen, 
  CheckCircle2, 
  GraduationCap, 
  ChevronRight, 
  Crown,
  Zap,
  BarChart3
} from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import SupportWidget from './SupportWidget';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* ------------------------------------ */}
      {/* 1. ANTET / TOP BAR                   */}
      {/* ------------------------------------ */}
      <header className="sticky top-0 z-40 border-b border-stone-800/80 bg-stone-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Brand Logo & User Info */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-black text-lg shadow-lg shadow-emerald-900/30">
              M
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-white text-base">Alexandru Popa</span>
                <Crown className="h-4 w-4 text-amber-400 fill-amber-400" />
              </div>
              <span className="text-xs text-stone-400">Biletul Spre Medicină • Premium</span>
            </div>
          </div>

          {/* Slogan Centrat (Simplu, Curat & Lizibil) */}
          <div className="hidden md:flex items-center justify-center flex-1 px-4 text-center">
            <p className="font-display text-sm lg:text-base tracking-tight">
              <span className="text-stone-400 font-medium">Antrenează-te zilnic</span>
              <span className="mx-2 text-stone-600">•</span>
              <span className="text-white font-bold">Devino <span className="text-emerald-400 font-black">cel mai bun</span></span>
            </p>
          </div>

          {/* User Action Badge */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3 py-1 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Sesiune Activă
            </span>
          </div>
        </div>
      </header>

      {/* ------------------------------------ */}
      {/* MAIN CONTENT AREA                    */}
      {/* ------------------------------------ */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">

        {/* ------------------------------------ */}
        {/* 2. TIMER-UL SIMPLIFICAT (VERDE ÎNCHIS)*/}
        {/* ------------------------------------ */}
        <section className="relative">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-900/50 bg-emerald-950 p-6 sm:p-8 shadow-xl">
            <p className="mb-5 text-center font-display text-sm font-bold tracking-wide text-white sm:text-base">
              Materiale noi pe platformă în:
            </p>

            {/* Componenta de Cronometru Invers */}
            <CountdownTimer />

            <p className="mx-auto mt-5 max-w-xl text-center text-xs sm:text-sm font-medium text-white leading-relaxed">
              Alătură-te comunității de viitori medici și fii primul care accesează noile simulări și grile explicate.
            </p>
          </div>
        </section>

        {/* ------------------------------------ */}
        {/* 3. CELE 6 CARDURI DE STATISTICI      */}
        {/* ------------------------------------ */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-400" />
              Progresul Tău
            </h2>
            <span className="text-xs text-stone-400">Actualizat în timp real</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Card 1: Grile Rezolvate */}
            <div className="group relative overflow-hidden rounded-2xl border border-stone-800 bg-stone-900/80 p-4 transition-all duration-300 hover:border-emerald-500/50 hover:bg-stone-900">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-stone-400">Grile Parcurse</span>
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <p className="font-display text-2xl font-black text-white">1,420</p>
              <p className="text-[11px] text-emerald-400 font-medium mt-1">+45 azi</p>
            </div>

            {/* Card 2: Acuratețe */}
            <div className="group relative overflow-hidden rounded-2xl border border-stone-800 bg-stone-900/80 p-4 transition-all duration-300 hover:border-emerald-500/50 hover:bg-stone-900">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-stone-400">Acuratețe</span>
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 group-hover:scale-110 transition-transform">
                  <Target className="h-4 w-4" />
                </div>
              </div>
              <p className="font-display text-2xl font-black text-white">92.4%</p>
              <p className="text-[11px] text-emerald-400 font-medium mt-1">Top 5% studenți</p>
            </div>

            {/* Card 3: Ore de Studiu */}
            <div className="group relative overflow-hidden rounded-2xl border border-stone-800 bg-stone-900/80 p-4 transition-all duration-300 hover:border-emerald-500/50 hover:bg-stone-900">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-stone-400">Timp Studiu</span>
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 group-hover:scale-110 transition-transform">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <p className="font-display text-2xl font-black text-white">128h</p>
              <p className="text-[11px] text-stone-400 mt-1">Săptămâna aceasta</p>
            </div>

            {/* Card 4: Simulări */}
            <div className="group relative overflow-hidden rounded-2xl border border-stone-800 bg-stone-900/80 p-4 transition-all duration-300 hover:border-emerald-500/50 hover:bg-stone-900">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-stone-400">Simulări UMFCD</span>
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 group-hover:scale-110 transition-transform">
                  <GraduationCap className="h-4 w-4" />
                </div>
              </div>
              <p className="font-display text-2xl font-black text-white">18/20</p>
              <p className="text-[11px] text-emerald-400 font-medium mt-1">90 puncte medie</p>
            </div>

            {/* Card 5: Clasament */}
            <div className="group relative overflow-hidden rounded-2xl border border-stone-800 bg-stone-900/80 p-4 transition-all duration-300 hover:border-emerald-500/50 hover:bg-stone-900">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-stone-400">Clasament</span>
                <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400 group-hover:scale-110 transition-transform">
                  <Award className="h-4 w-4" />
                </div>
              </div>
              <p className="font-display text-2xl font-black text-white">Locul 14</p>
              <p className="text-[11px] text-amber-400 font-medium mt-1">Pe țară</p>
            </div>

            {/* Card 6: Streak (Zile consecutive) */}
            <div className="group relative overflow-hidden rounded-2xl border border-stone-800 bg-stone-900/80 p-4 transition-all duration-300 hover:border-emerald-500/50 hover:bg-stone-900">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-stone-400">Zile Consecutive</span>
                <div className="rounded-xl bg-amber-500/10 p-2 text-amber-500 group-hover:scale-110 transition-transform">
                  <Flame className="h-4 w-4 animate-bounce" />
                </div>
              </div>
              <p className="font-display text-2xl font-black text-white">24 Zile</p>
              <p className="text-[11px] text-amber-400 font-medium mt-1">Fără întrerupere!</p>
            </div>
          </div>
        </section>

        {/* ------------------------------------ */}
        {/* 4. GRILE PE LECȚII (ACCES DIRECT)   */}
        {/* ------------------------------------ */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-400" />
                Grile pe Lecții & Capitole
              </h2>
              <p className="text-xs text-stone-400 mt-1">Exersează țintit pe materia pentru admitere</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Anatomie */}
            <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 hover:border-stone-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">Anatomie & Fiziologie</span>
                  <span className="text-xs text-stone-400 font-semibold">1,200 Grile</span>
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2">Sistemul Nervos & Organele de Simț</h3>
                <p className="text-xs text-stone-400 leading-relaxed mb-4">
                  Sinapse, reflexe și căi de conducere. Grile explicate pas cu pas.
                </p>
              </div>

              <div>
                <div className="w-full bg-stone-800 rounded-full h-1.5 mb-4">
                  <div className="bg-emerald-500 h-1.5 rounded-full w-[75%]" />
                </div>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-800 hover:bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-all">
                  Reia Testul
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Chimie Organică */}
            <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 hover:border-stone-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">Chimie Organică</span>
                  <span className="text-xs text-stone-400 font-semibold">850 Grile</span>
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2">Compuşi cu Funcțiuni Simple</h3>
                <p className="text-xs text-stone-400 leading-relaxed mb-4">
                  Alcooli, fenoli, amine și reacții de identificare.
                </p>
              </div>

              <div>
                <div className="w-full bg-stone-800 rounded-full h-1.5 mb-4">
                  <div className="bg-emerald-500 h-1.5 rounded-full w-[40%]" />
                </div>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white transition-all">
                  Începe Testul
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Fizică Medicală */}
            <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 hover:border-stone-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">Fizică Medicală</span>
                  <span className="text-xs text-stone-400 font-semibold">500 Grile</span>
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2">Optică Geometrică & Lente</h3>
                <p className="text-xs text-stone-400 leading-relaxed mb-4">
                  Formule, probleme de refracție și instrumente optice.
                </p>
              </div>

              <div>
                <div className="w-full bg-stone-800 rounded-full h-1.5 mb-4">
                  <div className="bg-emerald-500 h-1.5 rounded-full w-[10%]" />
                </div>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-800 hover:bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-all">
                  Începe Testul
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------ */}
        {/* 5. EXAMENE ŞI SIMULĂRI UMFCD        */}
        {/* ------------------------------------ */}
        <section className="rounded-3xl border border-stone-800 bg-gradient-to-r from-stone-900 via-stone-900 to-emerald-950/40 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/20">
                <Sparkles className="h-3.5 w-3.5" /> Official Mock Exam
              </span>
              <h2 className="font-display text-2xl font-bold text-white">
                Simulare Națională UMFCD 2026
              </h2>
              <p className="text-xs sm:text-sm text-stone-400 max-w-xl">
                Testează-te în condiții reale de examen: 100 de grile, cronometru oficial de 3 ore și clasament live instant.
              </p>
            </div>

            <button className="shrink-0 flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-950/50 transition-all active:scale-95">
              <Zap className="h-4 w-4 fill-white" />
              Intră în Simularea Oficială
            </button>
          </div>
        </section>

      </main>

      {/* ------------------------------------ */}
      {/* 6. WIDGET-UL PLUTITOR DE SUPORT      */}
      {/* ------------------------------------ */}
      <SupportWidget />
    </div>
  );
}