import { useEffect, useRef } from 'react';

/**
 * Mobile Phone Back-Navigation & Undo System
 * Intercepts Android hardware back button, iOS swipe-back gestures, and browser
 * back buttons to naturally navigate backward through:
 * 1. Open modals, drawers, and confirmation dialogs (closes the top modal/undoes action)
 * 2. Nested view states and expanded cards
 * 3. Tab navigation history (returns to the previously visited tab/screen)
 */

interface ModalStackEntry {
  id: string;
  onClose: () => void;
  priority?: number;
}

interface PageBackEntry {
  id: string;
  onBack: () => void;
  priority?: number;
}

class NavigationHistoryService {
  private modalStack: ModalStackEntry[] = [];
  private pageBackStack: PageBackEntry[] = [];
  private tabHistory: string[] = [];
  private isNavigatingBack = false;
  private onTabChangeCallback: ((tab: string) => void) | null = null;
  private initialized = false;
  private listeners: Array<() => void> = [];

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // Establish an initial baseline history entry if not already set
    try {
      if (!window.history.state || !window.history.state.barTrackInit) {
        window.history.replaceState({ barTrackInit: true, depth: 0 }, '');
      }
    } catch {
      // ignore
    }

    window.addEventListener('popstate', (event) => {
      this.handlePopState(event);
    });

    // Also support keyboard Escape key as a backward navigation action
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.triggerBack();
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (_) {}
    });
  }

  public canGoBack(): boolean {
    return (
      this.modalStack.length > 0 ||
      this.pageBackStack.length > 0 ||
      this.tabHistory.length > 1
    );
  }

  /**
   * Registers a modal / dialog / overlay to be closed when phone Back button is pressed.
   * Returns an unregister cleanup function.
   */
  public registerModal(id: string, onClose: () => void, priority: number = 0): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const entry: ModalStackEntry = { id, onClose, priority };
    this.modalStack.push(entry);
    this.notify();

    // Push a state into browser history so hardware back triggers popstate instead of exiting
    if (!this.isNavigatingBack) {
      try {
        window.history.pushState({ type: 'modal', id, depth: this.modalStack.length }, '');
      } catch {
        // ignore
      }
    }

    return () => {
      const index = this.modalStack.findIndex((m) => m === entry);
      if (index !== -1) {
        this.modalStack.splice(index, 1);
        this.notify();
        // If modal was closed via an on-screen X or Cancel button (not the phone back button),
        // gently pop the browser history entry to avoid accumulating dead forward states.
        if (!this.isNavigatingBack && typeof window !== 'undefined') {
          try {
            if (window.history.state && window.history.state.type === 'modal' && window.history.state.id === id) {
              this.isNavigatingBack = true;
              window.history.back();
              setTimeout(() => {
                this.isNavigatingBack = false;
              }, 60);
            }
          } catch {
            this.isNavigatingBack = false;
          }
        }
      }
    };
  }

  /**
   * Registers a page-level back action (e.g. Active counter reverting to setup Page 2).
   */
  public registerPageBack(id: string, onBack: () => void, priority: number = 0): () => void {
    const entry: PageBackEntry = { id, onBack, priority };
    this.pageBackStack.push(entry);
    this.notify();

    return () => {
      const index = this.pageBackStack.findIndex((p) => p === entry);
      if (index !== -1) {
        this.pageBackStack.splice(index, 1);
        this.notify();
      }
    };
  }

  /**
   * Records a tab navigation change into history.
   */
  public pushTab(tab: string) {
    if (!tab || this.isNavigatingBack) return;

    const currentTab = this.tabHistory[this.tabHistory.length - 1];
    if (currentTab === tab) return;

    this.tabHistory.push(tab);
    this.notify();

    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({ type: 'tab', tab, depth: this.tabHistory.length }, '');
      } catch {
        // ignore
      }
    }
  }

  /**
   * Initializes or syncs the active tab without pushing a new history entry (e.g. on mount)
   */
  public setInitialTab(tab: string) {
    if (this.tabHistory.length === 0) {
      this.tabHistory = [tab];
      this.notify();
    }
  }

  /**
   * Connects App tab switching to backward navigation
   */
  public subscribeTabChange(callback: (tab: string) => void): () => void {
    this.onTabChangeCallback = callback;
    return () => {
      if (this.onTabChangeCallback === callback) {
        this.onTabChangeCallback = null;
      }
    };
  }

  /**
   * Programmatic back navigation trigger (e.g. Back button in UI or Escape key)
   */
  public triggerBack(): boolean {
    // 1. If any modal / dialog is open, close topmost modal
    if (this.modalStack.length > 0) {
      const top = this.modalStack.pop();
      if (top) {
        top.onClose();
        this.notify();
        if (typeof window !== 'undefined') {
          try {
            this.isNavigatingBack = true;
            window.history.back();
            setTimeout(() => {
              this.isNavigatingBack = false;
            }, 60);
          } catch {
            this.isNavigatingBack = false;
          }
        }
        return true;
      }
    }

    // 2. If an active page-level back action exists (e.g. counter revert to Page 2), trigger it
    if (this.pageBackStack.length > 0) {
      const top = this.pageBackStack[this.pageBackStack.length - 1];
      if (top) {
        top.onBack();
        this.notify();
        return true;
      }
    }

    // 3. Tab navigation history (navigate back to previous visited tab)
    if (this.tabHistory.length > 1) {
      this.isNavigatingBack = true;
      this.tabHistory.pop(); // remove current tab
      const previousTab = this.tabHistory[this.tabHistory.length - 1];
      if (previousTab && this.onTabChangeCallback) {
        this.onTabChangeCallback(previousTab);
      }
      this.notify();
      if (typeof window !== 'undefined') {
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
      setTimeout(() => {
        this.isNavigatingBack = false;
      }, 60);
      return true;
    }

    // 4. Fallback to browser history
    if (typeof window !== 'undefined' && window.history.length > 1) {
      try {
        window.history.back();
        return true;
      } catch (_) {}
    }

    return false;
  }

  /**
   * Main PopState event handler triggered when phone hardware/gesture Back button is used.
   */
  private handlePopState(_event: PopStateEvent) {
    // 1. If any modal / dialog / overlay is open, close the topmost modal (undo action)
    if (this.modalStack.length > 0) {
      this.isNavigatingBack = true;
      const top = this.modalStack.pop();
      if (top) {
        top.onClose();
        this.notify();
      }
      setTimeout(() => {
        this.isNavigatingBack = false;
      }, 60);
      return;
    }

    // 2. If a page-level back action is registered
    if (this.pageBackStack.length > 0) {
      const top = this.pageBackStack[this.pageBackStack.length - 1];
      if (top) {
        top.onBack();
        this.notify();
        return;
      }
    }

    // 3. If no modal is open, navigate backward through tab history
    if (this.tabHistory.length > 1) {
      this.isNavigatingBack = true;
      this.tabHistory.pop(); // remove current tab
      const previousTab = this.tabHistory[this.tabHistory.length - 1];
      if (previousTab && this.onTabChangeCallback) {
        this.onTabChangeCallback(previousTab);
      }
      this.notify();
      setTimeout(() => {
        this.isNavigatingBack = false;
      }, 60);
      return;
    }

    // 4. User is at root tab with no modals open: keep the baseline state so user isn't dumped out of the app
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({ barTrackInit: true, depth: 0 }, '');
      } catch {
        // ignore
      }
    }
  }
}

export const navigationHistory = new NavigationHistoryService();

/**
 * React hook to register any modal, drawer, or expandable panel to close
 * on phone hardware back button or back navigation gestures.
 */
export function useBackHandler(
  isOpen: boolean,
  onClose: () => void,
  id: string = 'modal'
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    return navigationHistory.registerModal(id, () => {
      onCloseRef.current();
    });
  }, [isOpen, id]);
}

/**
 * React hook to register a page-level undo/back handler.
 */
export function usePageBack(
  id: string,
  onBack: () => void,
  enabled: boolean = true
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;

    return navigationHistory.registerPageBack(id, () => {
      onBackRef.current();
    });
  }, [enabled, id]);
}
