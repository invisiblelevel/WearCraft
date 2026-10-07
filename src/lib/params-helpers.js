// Хелперы для ParamsPanel и его подкомпонентов.
import { settings, ui } from './stores.svelte.js';

export function rgbToCss([r, g, b]) {
  return `rgb(${r}, ${g}, ${b})`;
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function openMasksLibrary(preset) {
  if (!settings.masksInfoShown) {
    ui.pendingMasksLibrary = preset;
    ui.masksInfoOpen = true;
  } else {
    ui.masksLibraryOpen = preset;
  }
}