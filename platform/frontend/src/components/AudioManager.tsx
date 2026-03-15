import { createContext, useContext, useEffect, useRef, useState } from 'react';

interface AudioContextType {
  playClick: () => void;
  toggleBgm: () => void;
  bgmEnabled: boolean;
}

const AudioContext = createContext<AudioContextType>({
  playClick: () => {},
  toggleBgm: () => {},
  bgmEnabled: true,
});

export const useAudio = () => useContext(AudioContext);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const clickRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bgmRef.current = new Audio('https://gz100.cdn.bcebos.com/mydir/tmp_data/01979497b5d610fecb2793b1520ae6e5.mp3');
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.3;

    clickRef.current = new Audio('/click.mp3');
    clickRef.current.volume = 0.5;

    return () => {
      bgmRef.current?.pause();
      clickRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (unlocked && bgmEnabled && bgmRef.current) {
      bgmRef.current.play().catch(() => {});
    } else if (bgmRef.current) {
      bgmRef.current.pause();
    }
  }, [bgmEnabled, unlocked]);

  const unlock = () => {
    if (!unlocked) {
      const silent = new Audio('/nothing.mp3');
      silent.play().then(() => {
        setUnlocked(true);
        silent.pause();
      }).catch(() => {});
    }
  };

  const playClick = () => {
    unlock();
    if (clickRef.current) {
      clickRef.current.currentTime = 0;
      clickRef.current.play().catch(() => {});
    }
  };

  const toggleBgm = () => setBgmEnabled(prev => !prev);

  return (
    <AudioContext.Provider value={{ playClick, toggleBgm, bgmEnabled }}>
      {children}
    </AudioContext.Provider>
  );
}
