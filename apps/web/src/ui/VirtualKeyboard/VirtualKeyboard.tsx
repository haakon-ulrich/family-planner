import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
// CJS bundle exports { KeyboardReact, default } — named import avoids Vite interop issue
import { KeyboardReact as Keyboard } from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';

type KeyboardHandle = { setInput: (value: string) => void };

const textLayout = {
  default: [
    'q w e r t z u i o p ü',
    'a s d f g h j k l ö ä ß',
    '{shift} y x c v b n m {bksp}',
    '{numbers} , {space} . {done}',
  ],
  shift: [
    'Q W E R T Z U I O P Ü',
    'A S D F G H J K L Ö Ä ẞ',
    '{shift} Y X C V B N M {bksp}',
    '{numbers} , {space} . {done}',
  ],
  numbers: [
    '1 2 3 4 5 6 7 8 9 0',
    '- / : ; ( ) & @ " \'',
    '{abc} . , ? ! {bksp}',
    '{abc} {space} {done}',
  ],
};

const numericLayout = {
  default: ['7 8 9', '4 5 6', '1 2 3', '{bksp} 0 {done}'],
};

const display = {
  '{bksp}': '⌫',
  '{shift}': '⇧',
  '{space}': ' ',
  '{done}': 'Fertig',
  '{numbers}': '123',
  '{abc}': 'ABC',
};

type Props = {
  visible: boolean;
  isNumeric: boolean;
  onChange: (value: string) => void;
  onDismiss: () => void;
  keyboardRef: React.RefObject<KeyboardHandle | null>;
};

export const VirtualKeyboard = ({ visible, isNumeric, onChange, onDismiss, keyboardRef }: Props) => {
  const [layoutName, setLayoutName] = useState('default');

  useEffect(() => {
    setLayoutName('default');
  }, [isNumeric]);

  const handleKeyPress = (button: string) => {
    if (button === '{shift}') setLayoutName((p) => (p === 'shift' ? 'default' : 'shift'));
    else if (button === '{numbers}') setLayoutName('numbers');
    else if (button === '{abc}') setLayoutName('default');
    else if (button === '{done}') { onDismiss(); setLayoutName('default'); }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 35, stiffness: 400 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 border-t border-slate-700 p-3 shadow-2xl flex justify-center"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="w-full max-w-2xl">
            <Keyboard
              keyboardRef={(r) => { keyboardRef.current = r; }}
              layout={isNumeric ? numericLayout : textLayout}
              layoutName={layoutName}
              display={display}
              theme="hg-theme-default kiosk-keyboard"
              onChange={onChange}
              onKeyPress={handleKeyPress}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
