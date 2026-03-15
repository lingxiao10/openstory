import { createContext, useContext, useEffect, useRef, useState } from 'react';

interface AudioContextType {
  playClick: () => void;
  toggleBgm: () => void;
  bgmEnabled: boolean;
  bgmVolume: number;
  setBgmVolume: (v: number) => void;
  setBgmActive: (active: boolean) => void;
}

const AudioContext = createContext<AudioContextType>({
  playClick: () => {},
  toggleBgm: () => {},
  bgmEnabled: true,
  bgmVolume: 0.3,
  setBgmVolume: () => {},
  setBgmActive: () => {},
});

export const useAudio = () => useContext(AudioContext);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [bgmActive, setBgmActive] = useState(false);
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
    console.log('[AudioManager] clickRef initialized, src:', clickRef.current.src);
    clickRef.current.addEventListener('error', (e) => {
      console.error('[AudioManager] click.mp3 load error:', e, clickRef.current?.error);
    });

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
    if (unlocked && bgmEnabled && bgmActive && bgmRef.current) {
      bgmRef.current.play().catch(() => {});
    } else if (bgmRef.current) {
      bgmRef.current.pause();
    }
  }, [bgmEnabled, unlocked, bgmActive]);

  const setBgmVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setBgmVolumeState(clamped);
    localStorage.setItem('bgm_volume', String(clamped));
  };

  const playClick = () => {
    console.log('[AudioManager] playClick called, unlocked:', unlocked, 'clickRef:', !!clickRef.current, 'src:', clickRef.current?.src);
    if (!unlocked) setUnlocked(true);
    if (clickRef.current) {
      clickRef.current.currentTime = 0;
      clickRef.current.play().then(() => {
        console.log('[AudioManager] click.mp3 play() resolved OK');
      }).catch((e) => {
        console.warn('[AudioManager] click.mp3 play() failed:', e);
      });
    } else {
      console.warn('[AudioManager] clickRef.current is null, cannot play click.mp3');
    }
  };

  const toggleBgm = () => setBgmEnabled(prev => !prev);

  return (
    <AudioContext.Provider value={{ playClick, toggleBgm, bgmEnabled, bgmVolume, setBgmVolume, setBgmActive }}>
      {children}
    </AudioContext.Provider>
  );
}
