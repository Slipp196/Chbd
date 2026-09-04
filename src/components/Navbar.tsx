import React, { useState } from 'react';
import { Volume2, VolumeX, Gamepad2, PlusCircle, User as UserIcon, LogOut, Download } from 'lucide-react';
import { toggleMute, getMuteState } from '../utils/sound';
import { ChbdLogo } from './ChbdLogo';
import { User } from '../types';

interface NavbarProps {
  currentTab: 'play' | 'admin';
  onTabChange: (tab: 'play' | 'admin') => void;
  onExitCategory?: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenDownload?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onExitCategory,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenDownload,
}) => {
  const [muted, setMuted] = React.useState<boolean>(getMuteState());
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSoundToggle = () => {
    const isNowMuted = toggleMute();
    setMuted(isNowMuted);
  };

  const handleLogoClick = () => {
    if (onExitCategory) {
      onExitCategory();
    }
    onTabChange('play');
  };

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-6 pt-4 pb-2 pointer-events-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Left Island: Clean Logo WITHOUT border, pure floating island */}
        <div className="pointer-events-auto">
          <button
            id="nav-brand-logo"
            onClick={handleLogoClick}
            title="Что было дальше? • На главную"
            className="flex items-center justify-center w-10 h-10 rounded-2xl bg-zinc-900/85 hover:bg-zinc-800/90 backdrop-blur-xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none p-1.5 group"
          >
            <ChbdLogo className="w-7 h-7 rounded-xl transition-transform duration-200 group-hover:scale-105" />
          </button>
        </div>

        {/* Center Island: Elegant Switcher ("Играть" | "Создать ЧБД") */}
        <div className="pointer-events-auto flex items-center p-1 rounded-full bg-zinc-900/85 border border-white/10 backdrop-blur-xl shadow-lg">
          <button
            id="nav-tab-play"
            onClick={() => onTabChange('play')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              currentTab === 'play'
                ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Играть</span>
          </button>

          <button
            id="nav-tab-admin"
            onClick={() => onTabChange('admin')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              currentTab === 'admin'
                ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Создать ЧБД</span>
          </button>
        </div>

        {/* Right Island: Sound Mute & User Profile / Login */}
        <div className="pointer-events-auto flex items-center gap-2">
          {currentUser ? (
            <div className="relative">
              <button
                id="nav-user-profile"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="h-10 px-3 rounded-2xl bg-zinc-900/85 hover:bg-zinc-800/90 border border-white/10 text-xs font-medium text-zinc-200 flex items-center gap-2 backdrop-blur-xl shadow-lg transition-all focus:outline-none"
              >
                <div className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-[10px] font-bold">
                  {currentUser.username[0].toUpperCase()}
                </div>
                <span className="max-w-[90px] truncate">{currentUser.username}</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 rounded-2xl bg-zinc-900/95 border border-white/10 p-1.5 shadow-2xl backdrop-blur-xl z-50">
                  <div className="px-3 py-2 text-[11px] text-zinc-400 border-b border-white/5">
                    Привет, <span className="font-semibold text-zinc-200">{currentUser.username}</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Выйти</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              id="nav-login-btn"
              onClick={onOpenAuth}
              className="h-10 px-3.5 rounded-2xl bg-zinc-900/85 hover:bg-zinc-800/90 border border-white/10 text-xs font-medium text-zinc-200 hover:text-white flex items-center gap-1.5 backdrop-blur-xl shadow-lg transition-all focus:outline-none"
            >
              <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>Войти</span>
            </button>
          )}

          <button
            id="nav-sound-toggle"
            onClick={handleSoundToggle}
            aria-label={muted ? 'Включить звук' : 'Выключить звук'}
            title={muted ? 'Включить звук' : 'Выключить звук'}
            className="w-10 h-10 rounded-2xl bg-zinc-900/85 hover:bg-zinc-800/90 border border-white/10 hover:border-white/25 backdrop-blur-xl shadow-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-all duration-200 focus:outline-none"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
