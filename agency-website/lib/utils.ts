// This utility file provides a function to combine CSS class names.
// It uses clsx for conditional class names and tailwind-merge to merge Tailwind CSS classes properly.
// This file provides a utility function cn for merging CSS class names using clsx and tailwind-merge.
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
