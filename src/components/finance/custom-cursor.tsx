import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export function CustomCursor() {
  const [mounted, setMounted] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const ringX = useSpring(x, { stiffness: 300, damping: 24, mass: 0.2 });
  const ringY = useSpring(y, { stiffness: 300, damping: 24, mass: 0.2 });

  useEffect(() => {
    setMounted(true);

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      if (!visible) setVisible(true);
    };

    const onEnter = () => setVisible(true);
    const onLeave = () => setVisible(false);

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const interactive = target.closest(
        "a, button, [role='button'], input, textarea, select, label, [data-cursor-hover]"
      );
      setHovering(!!interactive);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    document.body.addEventListener("mouseenter", onEnter);
    document.body.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      document.body.removeEventListener("mouseenter", onEnter);
      document.body.removeEventListener("mouseleave", onLeave);
    };
  }, [x, y, visible]);

  if (!mounted) return null;

  const isTouch = typeof window !== "undefined" && "ontouchstart" in window;
  if (isTouch) return null;

  return (
    <>
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full bg-foreground"
        style={{
          x,
          y,
          translateX: "-50%",
          translateY: "-50%",
          width: 6,
          height: 6,
        }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      />
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9998] rounded-full border border-foreground/70 bg-transparent"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          width: hovering ? 40 : 28,
          height: hovering ? 40 : 28,
          opacity: visible ? 1 : 0,
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />
    </>
  );
}
