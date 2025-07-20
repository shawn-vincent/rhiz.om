
import { useDeferredValue } from "react";

export function useDeferredSearch<T>(value: T, delay: number) {
  const deferredValue = useDeferredValue(value);
  // In a real scenario, you might want to implement a custom debounce
  // or use a library for more control over the delay.
  // For now, useDeferredValue provides a basic deferral.
  return deferredValue;
}
