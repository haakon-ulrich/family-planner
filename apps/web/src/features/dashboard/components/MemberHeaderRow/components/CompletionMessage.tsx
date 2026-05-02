import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

const MESSAGES = [
  'Gut gemacht!',
  'Toll!',
  'Klasse!',
  'Weiter so!',
  'Super!',
  'Ausgezeichnet!',
  'Prima!',
  'Gut so!',
];

interface CompletionMessageProps {
  color: string;
}

const CompletionMessage = ({ color }: CompletionMessageProps) => {
  const message = useRef(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);

  return createPortal(
    <motion.div
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.08, 1, 0.95] }}
      transition={{ duration: 5, times: [0, 0.14, 0.62, 1], ease: 'easeInOut' }}
    >
      <span
        className="text-8xl lg:text-[10rem] font-black select-none text-center leading-none"
        style={{ color, textShadow: `0 4px 60px ${color}80` }}
      >
        {message.current}
      </span>
    </motion.div>,
    document.body,
  );
};

export default CompletionMessage;
