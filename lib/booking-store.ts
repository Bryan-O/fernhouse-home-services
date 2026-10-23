// Step 1 choices carry between pages in localStorage (keys in lib/config.ts).
// Every read and write is guarded: storage can be blocked or unavailable.

import {
  DEFAULT_HOME,
  DEFAULT_PET,
  STORAGE_KEYS,
  type CleanFrequency,
  type CleanService,
  type PetFrequency,
  type YardCondition,
} from './config';

export interface CleanStep1 {
  service: CleanService;
  freq: CleanFrequency;
  beds: number;
  baths: number;
}

export interface PetStep1 {
  petFreq: PetFrequency;
  dogs: number;
  yard: 'std' | 'large'; // 'large' = over ½ acre → quote
  cond: YardCondition;
}

export type ServiceTab = 'clean' | 'pet';

export const DEFAULT_CLEAN: CleanStep1 = { service: 'standard', freq: 'biweekly', beds: DEFAULT_HOME.bd, baths: DEFAULT_HOME.ba };
export const DEFAULT_PET_STEP1: PetStep1 = { petFreq: DEFAULT_PET.freq, dogs: DEFAULT_PET.dogs, yard: 'std', cond: DEFAULT_PET.cond };

/** Fired when a link elsewhere on the page picks a type of clean, so the booking card can follow. */
export const PICK_CLEAN_EVENT = 'fernhouse:pick-clean';

function read<T>(key: string): T | null {
  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null') as T | null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // Storage blocked — choices simply don't carry over.
  }
}

export function readClean(): CleanStep1 | null {
  const v = read<CleanStep1>(STORAGE_KEYS.cleanStep1);
  return v && v.service ? { ...DEFAULT_CLEAN, ...v } : null;
}

export function readPet(): PetStep1 | null {
  const v = read<PetStep1>(STORAGE_KEYS.pet);
  return v && v.petFreq ? { ...DEFAULT_PET_STEP1, ...v } : null;
}

export const writeClean = (v: CleanStep1) => write(STORAGE_KEYS.cleanStep1, v);
export const writePet = (v: PetStep1) => write(STORAGE_KEYS.pet, v);
export const writeServiceTab = (tab: ServiceTab) => write(STORAGE_KEYS.service, tab);

/**
 * Switch to home cleaning from a menu, card or button — optionally choosing a type of clean
 * or home size. Saved for /book, and announced to the booking card on the same page.
 */
export function pickClean(choice: Partial<CleanStep1> = {}) {
  writeClean({ ...(readClean() ?? DEFAULT_CLEAN), ...choice });
  writeServiceTab('clean');
  window.dispatchEvent(new CustomEvent<Partial<CleanStep1>>(PICK_CLEAN_EVENT, { detail: choice }));
}
