"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  useMotionValue,
  useSpring,
  useMotionValueEvent,
} from "framer-motion";

gsap.registerPlugin(ScrollTrigger);

const Trophy3D = dynamic(
  () => import("@/components/Trophy3D").then((m) => m.Trophy3D),
  { ssr: false, loading: () => null }
);

/**
 * Coupe flottante pilotée par GSAP ScrollTrigger.
 *
 * 1. Position: fixed inset-0 — le Canvas Three.js couvre tout le viewport.
 * 2. GSAP ScrollTrigger scrub 1.2s → scrollProgress (0-1) dans une ref.
 * 3. Trophy3D interpole les keyframes 3D (position/scale/rotation)
 *    avec lerp dampening premium.
 * 4. Vélocité du scroll → tilt/roll physiques (rotation.x/z).
 */
export function FloatingTrophy() {
  const scrollProgressRef = useRef<number>(0);

  const xVel = useMotionValue(0);
  const yVel = useMotionValue(0);
  const smoothXVel = useSpring(xVel, { stiffness: 80, damping: 20, mass: 0.8 });
  const smoothYVel = useSpring(yVel, { stiffness: 80, damping: 20, mass: 0.8 });

  const spinSpeedRef = useRef<number>(0.22);
  const tiltRef = useRef<number>(0);
  const rollRef = useRef<number>(0);

  // GSAP ScrollTrigger : scroll global → progress 0-1
  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        scrub: 1.2,
        onUpdate: (self) => {
          scrollProgressRef.current = self.progress;
        },
      });
    });

    return () => ctx.revert();
  }, []);

  // Velocity → inclinaisons physiques
  useMotionValueEvent(smoothXVel, "change", (v) => {
    rollRef.current = Math.max(-0.4, Math.min(0.4, -v * 0.006));
  });

  useMotionValueEvent(smoothYVel, "change", (v) => {
    tiltRef.current = Math.max(-0.3, Math.min(0.3, v * 0.00012));
  });

  // Vélocité de scroll pour tilt/roll + spin boost
  useEffect(() => {
    let lastScrollY = 0;
    let lastTime = performance.now();
    let rafId: number;

    const update = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      if (dt > 0.001) {
        const currentScroll = window.scrollY;
        const velocity = (currentScroll - lastScrollY) / dt;

        xVel.set(velocity * 0.4);
        yVel.set(velocity);

        const boost = Math.min(Math.abs(velocity) / 300, 5);
        spinSpeedRef.current = 0.22 + boost;
      }
      lastScrollY = window.scrollY;
      lastTime = now;
      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [xVel, yVel]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-20 hidden md:block"
    >
      <Trophy3D
        className="h-full w-full"
        spinSpeedRef={spinSpeedRef}
        tiltRef={tiltRef}
        rollRef={rollRef}
        scrollProgressRef={scrollProgressRef}
      />
    </div>
  );
}