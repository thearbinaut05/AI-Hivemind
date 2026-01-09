import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines class names using clsx, then merges Tailwind classes to remove duplicates and conflicts.
 * 
 * @param inputs - A list of class names or expressions to be merged
 * @returns The merged string of class names 
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(...inputs))
}