import styles from './StatCard.module.css'

export default function StatCard({ label, value, delta, unit = '', accent = false }) {
  const isPositive = delta >= 0
  return (
    <div className={`${styles.card} ${accent ? styles.cardAccent : ''}`}>
      <span className={styles.label}>{label}</span>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {delta !== undefined && (
        <span className={`${styles.delta} ${isPositive ? styles.deltaUp : styles.deltaDown}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(delta)}% vs last month
        </span>
      )}
    </div>
  )
}
