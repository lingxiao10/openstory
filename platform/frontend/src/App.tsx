import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/authStore';
import { LangProvider } from './store/langStore';
import { AudioProvider } from './components/AudioManager';
import { Home } from './pages/Home';
import { GamePlayer } from './pages/GamePlayer';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { MyStories } from './pages/MyStories';
import { Admin } from './pages/Admin';
import { StreamGamePage } from './pages/StreamGamePage';
import { StoryReader } from './pages/StoryReader';
import { Stats } from './pages/Stats';

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <AudioProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game/:id" element={<GamePlayer />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/my-stories" element={<MyStories />} />
              <Route path="/create" element={<Navigate to="/my-stories" replace />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/stream-game/:storyId" element={<StreamGamePage />} />
              <Route path="/story/:id" element={<StoryReader />} />
            </Routes>
          </BrowserRouter>
        </AudioProvider>
      </AuthProvider>
    </LangProvider>
  );
}
