"use client";

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { AnimatedCounter } from "../animated-counter/animated-counter";
import { motionTokens } from "../lib/motion-tokens";

import styles from "./metric-card.module.css";

export interface MetricCardProps {
  label: string;
  value: number;
  suffix?: string;
  context: string;
  change?: string;
  /** Formatting locale for the counter. */
  locale?: string;
}

/** Copy that holds a number enters from the side it moved toward: a larger value rises from below, a smaller one drops from above. */
const rise: Variants = {
  gone: (direction: number) => ({
    opacity: 0,
    y: `${-0.3 * direction}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
  }),
  hidden: (direction: number) => ({
    opacity: 0,
    y: `${0.3 * direction}em`,
    filter: `blur(${motionTokens.blur.soft}px)`,
  }),
  shown: {
    filter: "blur(0px)",
    opacity: 1,
    transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
    y: 0,
  },
};
const fade: Variants = {
  gone: {
    filter: "blur(0px)",
    opacity: 0,
    transition: { duration: motionTokens.duration.instant },
    y: 0,
  },
  hidden: { filter: "blur(0px)", opacity: 0, y: 0 },
  shown: {
    filter: "blur(0px)",
    opacity: 1,
    transition: { duration: motionTokens.duration.instant },
    y: 0,
  },
};
const amountIn = (text: string) =>
  Number(text.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? Number.NaN);

/** New copy rises in while the old copy leaves; `morph` springs the wrapper to the new text's width instead of letting it snap. */
function Swap({
  text,
  morph = false,
  block = false,
}: {
  text: string;
  morph?: boolean;
  block?: boolean;
}) {
  const reduceMotion = !!useReducedMotion();
  const sizer = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | "auto">("auto");
  const [shown, setShown] = useState({ direction: 1, text });
  if (shown.text !== text) {
    setShown({ text, direction: amountIn(text) < amountIn(shown.text) ? -1 : 1 });
  }
  useEffect(() => {
    const node = sizer.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }
    let measured: string | null = null;
    // Layout size, not the transformed rect, so a scaling parent never leaves the text clipped. Only a new text springs; font loads jump.
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const next = entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth;
      if (next && measured !== null && measured !== node.textContent && !reduceMotion) {
        animate(width, next, motionTokens.spring.morph);
      } else {
        width.jump(next || "auto");
      }
      measured = next ? node.textContent : null;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [morph, reduceMotion, width]);
  return (
    <motion.span
      className={block ? styles.swapBlock : styles.swap}
      style={morph ? { width } : undefined}
    >
      {morph && (
        <span ref={sizer} className={styles.sizer} aria-hidden="true">
          {text}
        </span>
      )}
      <AnimatePresence mode="popLayout" initial={false} custom={shown.direction}>
        <motion.span
          key={text}
          className={styles.text}
          custom={shown.direction}
          variants={reduceMotion ? fade : rise}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

export function MetricCard({ label, value, suffix, context, change, locale }: MetricCardProps) {
  const reduceMotion = !!useReducedMotion();
  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <span>
          <Swap text={label} block />
        </span>
        <AnimatePresence initial={false}>
          {change && (
            <motion.small
              key="change"
              data-trend={/^[+]/.test(change) ? "up" : /^[-−]/.test(change) ? "down" : undefined}
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{
                opacity: 0,
                scale: reduceMotion ? 1 : 0.96,
                transition: {
                  duration: motionTokens.duration.fast,
                  ease: [...motionTokens.ease.standard],
                },
              }}
              transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
            >
              <Swap text={change} morph />
            </motion.small>
          )}
        </AnimatePresence>
      </div>
      <AnimatedCounter animateOnView locale={locale} suffix={suffix} value={value} />
      <p>
        <Swap text={context} block />
      </p>
    </article>
  );
}
