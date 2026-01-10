import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines multiple class names or conditional expressions using `clsx`,
 * then merges Tailwind CSS classes using `twMerge` to remove duplicates and handle conflicts.
 *
 * This utility helps maintain clean and conflict-free Tailwind CSS class strings.
 *
 * @param inputs - One or more class names or conditional class expressions
 * @returns A single merged class name string that's optimized for Tailwind CSS
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(...inputs))
}