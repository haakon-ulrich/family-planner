import { useEffect, useRef, useState } from 'react';
import { isKioskMode } from '@web/lib/kioskMode';

type KeyboardHandle = { setInput: (value: string) => void };

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'date', 'time']);
const NUMBER_TYPES = new Set(['number']);

// Simulates a React-compatible value change on a controlled input without
// a physical keyboard. React listens to the native 'input' event; calling
// the native setter before dispatching it keeps the synthetic onChange in sync.
const setNativeValue = (el: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

export const useKioskKeyboard = () => {
  const [visible, setVisible] = useState(false);
  const [isNumeric, setIsNumeric] = useState(false);
  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const keyboardRef = useRef<KeyboardHandle>(null);

  useEffect(() => {
    if (!isKioskMode) return;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLInputElement;
      if (target.tagName !== 'INPUT') return;
      if (!TEXT_TYPES.has(target.type) && !NUMBER_TYPES.has(target.type)) return;

      activeInputRef.current = target;
      setIsNumeric(NUMBER_TYPES.has(target.type));
      setVisible(true);
      setTimeout(() => keyboardRef.current?.setInput(target.value), 0);
    };

    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  const onChange = (value: string) => {
    if (activeInputRef.current) setNativeValue(activeInputRef.current, value);
  };

  const dismiss = () => {
    setVisible(false);
    activeInputRef.current?.blur();
    activeInputRef.current = null;
  };

  return { visible, isNumeric, onChange, dismiss, keyboardRef };
};
