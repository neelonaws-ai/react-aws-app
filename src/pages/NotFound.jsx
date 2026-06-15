import { Link } from 'react-router-dom'
import styles from './NotFound.module.css'

export default function NotFound() {
  return (
    <div className={styles.page}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.detail}>
        This route doesn't exist. Check the URL or return to the dashboard.
      </p>
      <Link to="/" className={styles.homeLink}>← Back to Dashboard</Link>
    </div>
  )
}
