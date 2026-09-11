import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import StudentDashboard from '@/pages/StudentDashboard';
import SimulationView from '@/pages/SimulationView';
import ResultsView from '@/pages/ResultsView';
import AdminDashboard from '@/pages/AdminDashboard';
import PracticeSetsView from '@/pages/PracticeSetsView';
import PracticeSetView from '@/pages/PracticeSetView';
import PracticeResultsView from '@/pages/PracticeResultsView';
import Loading from '@/components/Loading';
import SupportChat from '@/components/SupportChat';

type Route =
  | 'landing'
  | 'signin'
  | 'signup'
  | 'student-dashboard'
  | 'simulation'
  | 'results'
  | 'admin-dashboard'
  | 'practice-sets'
  | 'practice-solve'
  | 'practice-results';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [route, setRoute] = useState<Route>('landing');
  const [activeSimulationId, setActiveSimulationId] = useState<string | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [activePracticeLessonId, setActivePracticeLessonId] = useState<string | null>(null);
  const [activePracticeLessonTitle, setActivePracticeLessonTitle] = useState<string>('');
  const [activePracticeSetId, setActivePracticeSetId] = useState<string | null>(null);
  const [activePracticeAttemptId, setActivePracticeAttemptId] = useState<string | null>(null);
  const [practiceBuyingSub, setPracticeBuyingSub] = useState(false);
  const [practiceSubNonce, setPracticeSubNonce] = useState(0);
  const [studentInitialTab, setStudentInitialTab] = useState<'all' | 'practice' | 'umfcd' | 'dashboard'>('all');

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

  const handleOpenPracticeLesson = (lessonId: string, lessonTitle: string) => {
    setActivePracticeLessonId(lessonId);
    setActivePracticeLessonTitle(lessonTitle);
    setRoute('practice-sets');
  };

  const handleStartPracticeSet = (setId: string) => {
    setActivePracticeSetId(setId);
    setActivePracticeAttemptId(null);
    setRoute('practice-solve');
  };

  const handlePracticeComplete = (attemptId: string) => {
    setActivePracticeAttemptId(attemptId);
    setRoute('practice-results');
  };

  const handleViewPracticeResults = (setId: string, attemptId?: string) => {
    setActivePracticeSetId(setId);
    setActivePracticeAttemptId(attemptId || null);
    setRoute('practice-results');
  };

  const handleBuySubscription = async () => {
    setPracticeBuyingSub(true);
    try {
      const { error: rpcError } = await supabase.rpc('activate_test_subscription');
      if (rpcError) {
        console.error('Subscription activation error:', rpcError);
      } else {
        setPracticeSubNonce((n) => n + 1);
      }
    } catch (err) {
      console.error('Subscription error:', err);
    } finally {
      setPracticeBuyingSub(false);
    }
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

  // Practice routes
if (route === 'practice-sets' && activePracticeLessonId) {
    return (
      <>
        <PracticeSetsView
          key={`practice-sets-${activePracticeLessonId}-${practiceSubNonce}`}
          lessonId={activePracticeLessonId}
          lessonTitle={activePracticeLessonTitle}
          onStartSet={handleStartPracticeSet}
          onViewResults={handleViewPracticeResults}
          onBack={() => { setStudentInitialTab('practice'); setRoute('student-dashboard'); }}
          onBuySubscription={handleBuySubscription}
          buyingSub={practiceBuyingSub}
        />
        <SupportChat />
      </>
    );
  }

  if (route === 'practice-solve' && activePracticeSetId) {
    return (
      <PracticeSetView
        setId={activePracticeSetId}
        onExit={() => setRoute('practice-sets')}
        onComplete={handlePracticeComplete}
      />
    );
  }

  if (route === 'practice-results' && activePracticeSetId) {
    return (
      <>
        <PracticeResultsView
          setId={activePracticeSetId}
          attemptId={activePracticeAttemptId || undefined}
          onExit={() => setRoute('practice-sets')}
          onRetake={() => handleStartPracticeSet(activePracticeSetId)}
        />
        <SupportChat />
      </>
    );
  }

  if (route === 'simulation' && activeSimulationId) {
    return (
      <>
        <SimulationView
          simulationId={activeSimulationId}
          onExit={() => { setRoute('student-dashboard'); setActiveSimulationId(null); }}
          onComplete={handleSimulationComplete}
        />
        <SupportChat />
      </>
    );
  }

  if (route === 'results' && activeSimulationId) {
    return (
      <>
        <ResultsView
          simulationId={activeSimulationId}
          attemptId={activeAttemptId || undefined}
          onExit={() => { setRoute('student-dashboard'); setActiveSimulationId(null); setActiveAttemptId(null); }}
          onRetake={handleStartSimulation}
        />
        <SupportChat />
      </>
    );
  }

  return (
    <>
      <StudentDashboard
        onStartSimulation={handleStartSimulation}
        onViewResults={handleViewResults}
        onOpenPracticeLesson={handleOpenPracticeLesson}
        initialTab={studentInitialTab}
      />
      <SupportChat />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
