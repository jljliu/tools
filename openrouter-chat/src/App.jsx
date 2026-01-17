import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import useStore from './store/useStore';

function App() {
  const { init, apiKey, createNewChat, chats } = useStore();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    init();
  }, []);

  // Show settings automatically if no key is found after init (and slight delay)
  useEffect(() => {
    // Simple check: if initialized (we don't have isInitialized state but chats load indicates it somewhat)
    // Actually init is async. 
    // Manual trigger is fine.
  }, [apiKey]);

  useEffect(() => {
    // Create a initial chat if none exist
    // We can do this in store.init but separation is okay
    const setup = async () => {
      await init();
      const currentState = useStore.getState();
      if (currentState.chats.length === 0) {
        currentState.createNewChat();
      }
    }
    setup();
  }, []);

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans antialiased selection:bg-blue-500/30">
      <Sidebar onOpenSettings={() => setShowSettings(true)} />
      <ChatArea />

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

export default App;
