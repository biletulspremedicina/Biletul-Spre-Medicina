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
  const [isArchiveRetake, setIsArchiveRetake] = useState(false);

  // Route based on auth state
  useEffect(() => {
    if (loading) return;
    if (!session) {
      if (route !== 'signin' && route !== 'signup') {
        setRoute('landing');
      }
      return;
    }
    // Authenticated
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

  const handleStartSimulation = (simId: string, archive = false) => {
    setActiveSimulationId(simId);
    setIsArchiveRetake(archive);
    setRoute('simulation');
  };

  const handleViewResults = (simId: string) => {
    setActiveSimulationId(simId);
    setRoute('results');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loading message="Se încarcă..." />
      </div>
    );
  }

  // Unauthenticated routes
  if (!session) {
    if (route === 'signin') {
      return <AuthPage mode="signin" onSuccess={() => {}} onSwitchMode={(m) => setRoute(m)} onBack={handleBackToLanding} />;
    }
    if (route === 'signup') {
      return <AuthPage mode="signup" onSuccess={() => {}} onSwitchMode={(m) => setRoute(m)} onBack={handleBackToLanding} />;
    }
    return <LandingPage onGetStarted={handleGetStarted} onSignIn={handleSignIn} />;
  }

  // Authenticated routes
  if (profile?.role === 'admin') {
    return <AdminDashboard onExit={() => setRoute('landing')} />;
  }

  // Student routes
  if (route === 'simulation' && activeSimulationId) {
    return (
      <SimulationView
        simulationId={activeSimulationId}
        onExit={() => { setRoute('student-dashboard'); setActiveSimulationId(null); setIsArchiveRetake(false); }}
        onComplete={() => { setRoute('results'); }}
        isArchiveRetake={isArchiveRetake}
      />
    );
  }

  if (route === 'results' && activeSimulationId) {
    return <ResultsView simulationId={activeSimulationId} onExit={() => { setRoute('student-dashboard'); setActiveSimulationId(null); setIsArchiveRetake(false); }} isArchiveRetake={isArchiveRetake} />;
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
