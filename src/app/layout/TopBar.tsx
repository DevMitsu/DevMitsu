import { Link } from 'react-router-dom';
import { Menu, Settings } from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { ProfileMenu } from './ProfileMenu';

interface TopBarProps {
  navOpen: boolean;
  onMenuClick: () => void;
}

export function TopBar({ navOpen, onMenuClick }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 sm:px-5">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-expanded={navOpen}
        aria-controls="primary-navigation"
        className="grid size-10 shrink-0 place-items-center rounded-control text-ink hover:bg-sage-soft lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <Link
        to="/"
        className="shrink-0 rounded-control font-display text-[26px] leading-none text-navy lg:w-[calc(16rem-1.25rem)]"
      >
        <span className="hidden sm:inline">Alexandria</span>
        <span className="sm:hidden" aria-label="Alexandria">
          A
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 justify-center lg:justify-start">
        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Link
          to="/settings"
          aria-label="Settings"
          className="hidden size-10 place-items-center rounded-control text-muted hover:bg-sage-soft hover:text-ink sm:grid"
        >
          <Settings className="size-5" aria-hidden />
        </Link>
        <ProfileMenu />
      </div>
    </header>
  );
}
