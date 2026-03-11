import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './store/authStore';
import { LangProvider } from './store/langStore';
import { Home } from './pages/Home';
import { GamePlayer } from './pages/GamePlayer';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { MyStories } from './pages/MyStories';
import { StoryReader } from './pages/StoryReader';

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
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LangProvider>
  );
}
