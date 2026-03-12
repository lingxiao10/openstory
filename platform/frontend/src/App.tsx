import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/authStore';
import { LangProvider } from './store/langStore';
import { Home } from './pages/Home';
import { GamePlayer } from './pages/GamePlayer';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { MyStories } from './pages/MyStories';
import { StoryReader } from './pages/StoryReader';
import { Admin } from './pages/Admin';

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game/:id" element={<GamePlayer />} />
            <Route path="/story/:id" element={<StoryReader />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/my-stories" element={<MyStories />} />
            <Route path="/create" element={<Navigate to="/my-stories" replace />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LangProvider>
  );
}
