'use client';

import { useState } from 'react';
import { Icon } from '../ui/Icon';
import styles from './NewsletterForm.module.css';

/**
 * The v3 API has no newsletter endpoint yet, so the form says so instead of
 * pretending to subscribe (rule: never fake backend behavior).
 */
export function NewsletterForm({ labels }: { labels: { email: string; submit: string; soon: string } }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(labels.soon);
      }}
    >
      <label htmlFor="newsletter-email" className="visually-hidden">
        {labels.email}
      </label>
      <input id="newsletter-email" type="email" required placeholder={labels.email} className={styles.input} />
      <button type="submit" className={styles.button}>
        {labels.submit}
        <Icon name="arrow" size={18} directional />
      </button>
      <p role="status" className={styles.status}>
        {message}
      </p>
    </form>
  );
}
