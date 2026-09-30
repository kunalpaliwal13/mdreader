import type { Component } from 'svelte';

export type MenuItem =
  | { label: string; icon?: Component<any>; action: () => void; danger?: boolean; kbd?: string }
  | { sep: true }
  | { heading: string };

export const menu = $state<{ open: boolean; x: number; y: number; items: MenuItem[] }>({ open: false, x: 0, y: 0, items: [] });

/** Open at the mouse (contextmenu) or below an anchor element (button click). */
export function openMenu(e: MouseEvent, items: MenuItem[], anchor?: HTMLElement) {
  e.preventDefault();
  e.stopPropagation();
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    menu.x = r.left;
    menu.y = r.bottom + 4;
  } else {
    menu.x = e.clientX;
    menu.y = e.clientY;
  }
  menu.items = items;
  menu.open = true;
}

export function closeMenu() {
  menu.open = false;
}
