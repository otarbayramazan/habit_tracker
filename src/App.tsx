import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { HabitsProvider } from '@/context/HabitsContext';
import { AppShell } from '@/components/AppShell';

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <HabitsProvider>
          <AppShell />
        </HabitsProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
