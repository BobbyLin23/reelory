import { BrandMark } from "@/components/brand-mark";

import styles from "./brand-lockup.module.css";

/** The mark and wordmark, sized for a header bar. Colour comes from the parent, so both themes work from one render. */
export function BrandLockup() {
  return (
    <span className={styles.lockup}>
      <BrandMark className={styles.mark} />
      <span className={styles.word}>reelory</span>
    </span>
  );
}
