import { useGameStore } from './store/gameStore';
import { SetupScreen } from './components/setup/SetupScreen';
import { Dashboard } from './components/dashboard/Dashboard';
import { EndingScreen } from './components/ending/EndingScreen';

export default function App() {
  const state = useGameStore((s) => s.state);

  if (!state || state.gameStatus === 'setup') {
    return <SetupScreen />;
  }

  if (state.gameStatus === 'ended') {
    return <EndingScreen />;
  }

  return <Dashboard />;
}
