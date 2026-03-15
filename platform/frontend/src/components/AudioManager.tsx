import { createContext, useContext, useEffect, useRef, useState } from 'react';

interface AudioContextType {
  playClick: () => void;
  toggleBgm: () => void;
  bgmEnabled: boolean;
  bgmVolume: number;
  setBgmVolume: (v: number) => void;
}

const AudioContext = createContext<AudioContextType>({
  playClick: () => {},
  toggleBgm: () => {},
  bgmEnabled: true,
  bgmVolume: 0.3,
  setBgmVolume: () => {},
});

export const useAudio = () => useContext(AudioContext);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [bgmVolume, setBgmVolumeState] = useState(() => {
    const saved = localStorage.getItem('bgm_volume');
    return saved ? parseFloat(saved) : 0.3;
  });
  const [unlocked, setUnlocked] = useState(false);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const clickRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bgmRef.current = new Audio('https://gz100.cdn.bcebos.com/mydir/tmp_data/01979497b5d610fecb2793b1520ae6e5.mp3');
    bgmRef.current.loop = true;
    bgmRef.current.volume = bgmVolume;

    clickRef.current = new Audio('/click.mp3');
    clickRef.current.volume = 0.5;

    return () => {
      bgmRef.current?.pause();
      clickRef.current?.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bgmRef.current) bgmRef.current.volume = bgmVolume;
  }, [bgmVolume]);

  useEffect(() => {
    if (unlocked && bgmEnabled && bgmRef.current) {
      bgmRef.current.play().catch(() => {});
    } else if (bgmRef.current) {
      bgmRef.current.pause();
    }
  }, [bgmEnabled, unlocked]);

  const setBgmVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setBgmVolumeState(clamped);
    localStorage.setItem('bgm_volume', String(clamped));
  };

  const playClick = () => {
    if (!unlocked) setUnlocked(true);
    if (clickRef.current) {
      clickRef.current.currentTime = 0;
      clickRef.current.play().catch(() => {});
    }
  };

  const toggleBgm = () => setBgmEnabled(prev => !prev);

  return (
    <AudioContext.Provider value={{ playClick, toggleBgm, bgmEnabled, bgmVolume, setBgmVolume }}>
      {children}
    </AudioContext.Provider>
  );
}
