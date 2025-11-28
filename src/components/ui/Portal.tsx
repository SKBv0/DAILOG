import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: React.ReactNode;
  container?: HTMLElement;
  lockBodyScroll?: boolean;
}

export const Portal: React.FC<PortalProps> = ({
  children,
  container = typeof document !== "undefined" ? document.body : undefined,
  lockBodyScroll = false,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!lockBodyScroll || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lockBodyScroll]);

  if (!mounted || !container) return null;

  return createPortal(children, container);
};
