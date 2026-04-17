import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { SetupScreen } from './components/setup/SetupScreen';
import { Dashboard } from './components/dashboard/Dashboard';
import { EndingScreen } from './components/ending/EndingScreen';

export default function App() {
  const state = useGameStore((s) => s.state);
  const shouldWarnOnRefresh =
    Boolean(state) && state?.gameStatus !== 'ended';

  useEffect(() => {
    if (!shouldWarnOnRefresh) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldWarnOnRefresh]);

  if (!state || state.gameStatus === 'setup') {
    return <SetupScreen />;
  }

  if (state.gameStatus === 'ended') {
    return <EndingScreen />;
  }

  return <Dashboard />;
}
