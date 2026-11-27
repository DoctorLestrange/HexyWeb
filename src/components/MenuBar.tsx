import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import type { AppTheme } from '../utils/preferences';

interface MenuBarProps {
  theme: AppTheme;
  isHashing: boolean;
  canSaveHash: boolean;
  shortcutLabel: string;
  onToggleTheme: () => void;
  onOpenFile: () => void;
  onSaveHash: () => void;
  onClearAll: () => void;
  onOpenPreferences: () => void;
  onOpenLogs: () => void;
  onOpenHelp: () => void;
  onOpenAbout: () => void;
}

type ActiveMenuId = 'file' | 'edit' | 'help';
type MenuId = ActiveMenuId | null;

const MENU_ORDER: readonly ActiveMenuId[] = ['file', 'edit', 'help'];

export function MenuBar({
  theme,
  isHashing,
  canSaveHash,
  shortcutLabel,
  onToggleTheme,
  onOpenFile,
  onSaveHash,
  onClearAll,
  onOpenPreferences,
  onOpenLogs,
  onOpenHelp,
  onOpenAbout,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const [iconFailed, setIconFailed] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef<Record<ActiveMenuId, HTMLButtonElement | null>>({
    file: null,
    edit: null,
    help: null,
  });
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const focusFirstOnOpenRef = useRef(false);

  useEffect(() => {
    if (!openMenu) return;

    if (focusFirstOnOpenRef.current) {
      focusFirstOnOpenRef.current = false;
      requestAnimationFrame(() => {
        const firstEnabled = menuPanelRef.current?.querySelector<HTMLButtonElement>(
          '[role="menuitem"]:not([disabled])'
        );
        firstEnabled?.focus();
      });
    }

    const handlePointerDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        const closing = openMenu;
        setOpenMenu(null);
        triggerRefs.current[closing]?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  const runAction = (fn: () => void) => {
    setOpenMenu(null);
    fn();
  };

  const switchMenu = (current: ActiveMenuId, delta: -1 | 1, openNext: boolean) => {
    const idx = MENU_ORDER.indexOf(current);
    const nextMenu = MENU_ORDER[(idx + delta + MENU_ORDER.length) % MENU_ORDER.length];
    if (openNext) {
      focusFirstOnOpenRef.current = true;
      setOpenMenu(nextMenu);
    } else {
      triggerRefs.current[nextMenu]?.focus();
    }
  };

  const handleTriggerKeyDown = (menuId: ActiveMenuId, e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusFirstOnOpenRef.current = true;
      setOpenMenu(menuId);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      switchMenu(menuId, 1, openMenu !== null);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      switchMenu(menuId, -1, openMenu !== null);
    }
  };

  const handleMenuKeyDown = (menuId: ActiveMenuId, e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuPanelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ??
        []
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = currentIndex === -1 ? 0 : (currentIndex + 1) % items.length;
      items[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev =
        currentIndex <= 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      items[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      switchMenu(menuId, 1, true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      switchMenu(menuId, -1, true);
    }
  };

  return (
    <header className="w-full border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="mx-auto flex max-w-[960px] items-center justify-between gap-2 sm:gap-8 px-3 sm:px-6 h-14">
        {/* Zone 1: Single-line Brand wordmark */}
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          {!iconFailed ? (
            <img
              src={`${import.meta.env.BASE_URL}icon.png`}
              alt="Hexy logo"
              width={24}
              height={24}
              referrerPolicy="no-referrer"
              onError={() => setIconFailed(true)}
              className="h-6 w-6 shrink-0 select-none"
            />
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent)] text-white text-xs font-bold font-mono shrink-0"
            >
              #
            </span>
          )}
          <span className="text-base font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0">
            Hexy
          </span>
        </div>

        {/* Zone 2: Authentic File / Edit / Help menu navigation */}
        <nav
          ref={navRef}
          aria-label="Application menu"
          className="flex items-center gap-0.5 sm:gap-2"
        >
          {/* File menu */}
          <div className="relative">
            <button
              ref={(el) => {
                triggerRefs.current.file = el;
              }}
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'file'}
              onClick={() => setOpenMenu((cur) => (cur === 'file' ? null : 'file'))}
              onKeyDown={(e) => handleTriggerKeyDown('file', e)}
              className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                openMenu === 'file'
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              File
              <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            </button>

            {openMenu === 'file' && (
              <div
                ref={menuPanelRef}
                role="menu"
                aria-label="File"
                onKeyDown={(e) => handleMenuKeyDown('file', e)}
                className="absolute left-0 mt-1.5 w-56 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 shadow-[var(--shadow-popover)] z-40"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={isHashing}
                  onClick={() => runAction(onOpenFile)}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none disabled:opacity-45 disabled:pointer-events-none transition-colors text-left"
                >
                  <span>Open...</span>
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {shortcutLabel}+O
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canSaveHash || isHashing}
                  onClick={() => runAction(onSaveHash)}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none disabled:opacity-45 disabled:pointer-events-none transition-colors text-left"
                >
                  <span>Save Hash...</span>
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {shortcutLabel}+S
                  </span>
                </button>
                <div className="my-1.5 border-t border-[var(--border-subtle)]" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onClearAll)}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none transition-colors text-left"
                >
                  <span>Clear All</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit menu */}
          <div className="relative">
            <button
              ref={(el) => {
                triggerRefs.current.edit = el;
              }}
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'edit'}
              onClick={() => setOpenMenu((cur) => (cur === 'edit' ? null : 'edit'))}
              onKeyDown={(e) => handleTriggerKeyDown('edit', e)}
              className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                openMenu === 'edit'
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              Edit
              <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            </button>

            {openMenu === 'edit' && (
              <div
                ref={menuPanelRef}
                role="menu"
                aria-label="Edit"
                onKeyDown={(e) => handleMenuKeyDown('edit', e)}
                className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-1.5 w-56 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 shadow-[var(--shadow-popover)] z-40"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onOpenPreferences)}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none transition-colors text-left"
                >
                  <span>Preferences...</span>
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {shortcutLabel}+,
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onOpenLogs)}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none transition-colors text-left"
                >
                  <span>Logs...</span>
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {shortcutLabel}+L
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Help menu */}
          <div className="relative">
            <button
              ref={(el) => {
                triggerRefs.current.help = el;
              }}
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'help'}
              onClick={() => setOpenMenu((cur) => (cur === 'help' ? null : 'help'))}
              onKeyDown={(e) => handleTriggerKeyDown('help', e)}
              className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                openMenu === 'help'
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              Help
              <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            </button>

            {openMenu === 'help' && (
              <div
                ref={menuPanelRef}
                role="menu"
                aria-label="Help"
                onKeyDown={(e) => handleMenuKeyDown('help', e)}
                className="absolute right-0 sm:left-0 mt-1.5 w-52 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 shadow-[var(--shadow-popover)] z-40"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onOpenHelp)}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none transition-colors text-left"
                >
                  <span>How to Use</span>
                  <span className="font-mono text-xs text-[var(--text-muted)]">F1</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(onOpenAbout)}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none transition-colors text-left"
                >
                  <span>About Hexy</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Zone 3: Single primary theme switch action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Off-White theme' : 'Switch to Dark Graphite theme'}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
