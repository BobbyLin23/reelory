import styles from "./page-intro.module.css";

export function PageIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.intro}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
    </div>
  );
}
