import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { HabitsProvider } from '@/context/HabitsContext';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AuthProvider>
          <HabitsProvider>
            <AppShell />
          </HabitsProvider>
        </AuthProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
