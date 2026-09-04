import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import StudentDashboard from '@/pages/StudentDashboard';
import SimulationView from '@/pages/SimulationView';
import ResultsView from '@/pages/ResultsView';
import AdminDashboard from '@/pages/AdminDashboard';
import Loading from '@/components/Loading';

type Route =
  | 'landing'
  | 'signin'
  | 'signup'
  | 'student-dashboard'
  | 'simulation'
  | 'results'
  | 'admin-dashboard';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [route, setRoute] = useState<Route>('landing');
  const [activeSimulationId, setActiveSimulationId] = useState<string | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      if (route !== 'signin' && route !== 'signup') {
        setRoute('landing');
      }
      return;
    }
    if (route === 'landing' || route === 'signin' || route === 'signup') {
      if (profile?.role === 'admin') {
        setRoute('admin-dashboard');
      } else {
        setRoute('student-dashboard');
      }
    }
  }, [session, profile, loading, route]);

  const handleGetStarted = () => setRoute('signup');
  const handleSignIn = () => setRoute('signin');
  const handleBackToLanding = () => setRoute('landing');

  const handleStartSimulation = (simId: string) => {
    setActiveSimulationId(simId);
    setActiveAttemptId(null);
    setRoute('simulation');
  };

  const handleViewResults = (simId: string, attemptId?: string) => {
    setActiveSimulationId(simId);
    setActiveAttemptId(attemptId || null);
    setRoute('results');
  };

  const handleSimulationComplete = (attemptId: string) => {
    setActiveAttemptId(attemptId);
    setRoute('results');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loading message="Se încarcă..." />
      </div>
    );
  }

  if (!session) {
    if (route === 'signin') {
      return <AuthPage mode="signin" onSuccess={() => {}} onSwitchMode={(m) => setRoute(m)} onBack={handleBackToLanding} />;
    }
    if (route === 'signup') {
      return <AuthPage mode="signup" onSuccess={() => {}} onSwitchMode={(m) => setRoute(m)} onBack={handleBackToLanding} />;
    }
    return <LandingPage onGetStarted={handleGetStarted} onSignIn={handleSignIn} />;
  }

  if (profile?.role === 'admin') {
    return <AdminDashboard onExit={() => setRoute('landing')} />;
  }

  if (route === 'simulation' && activeSimulationId) {
    return (
      <SimulationView
        simulationId={activeSimulationId}
        onExit={() => { setRoute('student-dashboard'); setActiveSimulationId(null); }}
        onComplete={handleSimulationComplete}
      />
    );
  }

  if (route === 'results' && activeSimulationId) {
    return (
      <ResultsView
        simulationId={activeSimulationId}
        attemptId={activeAttemptId || undefined}
        onExit={() => { setRoute('student-dashboard'); setActiveSimulationId(null); setActiveAttemptId(null); }}
        onRetake={handleStartSimulation}
      />
    );
  }

  return (
    <StudentDashboard
      onStartSimulation={handleStartSimulation}
      onViewResults={handleViewResults}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
