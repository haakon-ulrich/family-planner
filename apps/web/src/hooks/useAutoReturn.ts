import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const RETURN_DELAY_MS = 5 * 60 * 1000;

const useAutoReturn = (pathname: string) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (pathname === '/') return;
    const id = setTimeout(() => navigate('/'), RETURN_DELAY_MS);
    return () => clearTimeout(id);
  }, [pathname, navigate]);
};

export default useAutoReturn;
