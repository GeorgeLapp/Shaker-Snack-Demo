import styles from './Eye.module.scss';
import { useRef, useEffect } from 'react';

const Eye = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (containerRef.current && eyeRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();

        const posX =
          ((event.clientX - (containerRect.x + containerRect.width / 2)) / window.innerWidth) * 100;
        const posY =
          ((event.clientY - (containerRect.y + containerRect.height / 2)) / window.innerHeight) *
          100;

        const formatedPosX = posX;
        const formatedPosY = posY;

        containerRef.current.style.transform = `translate(${formatedPosX * 0.01}%, ${formatedPosY * 0.01}%)`;
        eyeRef.current.style.transform = `translate(${formatedPosX / 2}%, ${formatedPosY / 2}%)`;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.square}>
        <div ref={eyeRef} className={styles.eyeball}></div>
      </div>
    </div>
  );
};

export default Eye;
