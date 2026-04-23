import { useEffect, useRef, useState } from 'react';

// Thumb-sized joystick for mobile. Returns a unit vector in [-1, 1] on
// each axis via onChange. Positioned as an absolute overlay - the parent
// decides where it sits.

interface Props {
  onChange: (x: number, y: number) => void;
  size?: number;
}

export function VirtualJoystick({ onChange, size = 120 }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeTouchId = useRef<number | null>(null);
  const centerRef = useRef({ x: 0, y: 0 });

  const updateFromPoint = (cx: number, cy: number, clientX: number, clientY: number) => {
    const dx = clientX - cx;
    const dy = clientY - cy;
    const r = size / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, r);
    const nx = (dx / Math.max(1, dist)) * clamped;
    const ny = (dy / Math.max(1, dist)) * clamped;
    setKnob({ x: nx, y: ny });
    onChange(nx / r, ny / r);
  };

  const beginDrag = (clientX: number, clientY: number) => {
    if (!outerRef.current) return;
    const rect = outerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    centerRef.current = { x: cx, y: cy };
    setDragging(true);
    updateFromPoint(cx, cy, clientX, clientY);
  };

  const moveDrag = (clientX: number, clientY: number) => {
    const { x: cx, y: cy } = centerRef.current;
    updateFromPoint(cx, cy, clientX, clientY);
  };

  const endDrag = () => {
    setDragging(false);
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
    activeTouchId.current = null;
  };

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (activeTouchId.current == null) return;
      for (const t of Array.from(e.touches)) {
        if (t.identifier === activeTouchId.current) {
          moveDrag(t.clientX, t.clientY);
          e.preventDefault();
          return;
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === activeTouchId.current) {
          endDrag();
          return;
        }
      }
    };
    if (dragging) {
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchcancel', onTouchEnd);
    }
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [dragging]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      moveDrag(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      if (dragging) endDrag();
    };
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  return (
    <div
      ref={outerRef}
      className="virtual-joystick"
      style={{ width: size, height: size }}
      onTouchStart={(e) => {
        const t = e.changedTouches[0];
        activeTouchId.current = t.identifier;
        beginDrag(t.clientX, t.clientY);
        e.preventDefault();
      }}
      onMouseDown={(e) => {
        beginDrag(e.clientX, e.clientY);
      }}
    >
      <div
        className="virtual-joystick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
