import { useState } from 'react'
import StatCard from '../components/StatCard'
import { useSalesforceBridge } from '../hooks/useSalesforceBridge'
import styles from './Dashboard.module.css'

const STATS = [
  { label: 'Active Cases',    value: '2,841', delta: 12,  unit: '',   accent: true },
  { label: 'Resolved Today', value: '147',   delta: 8,   unit: ''         },
  { label: 'Avg Handle Time', value: '4.2',  delta: -3,  unit: 'min'      },
  { label: 'CSAT Score',      value: '94',   delta: 2,   unit: '%'        },
]

const ACTIVITY = [
  { id: 1, type: 'Case Created',  detail: 'Case #00341 — Portal access issue',     time: '2m ago',  status: 'open'     },
  { id: 2, type: 'Case Resolved', detail: 'Case #00339 — Account merge complete',  time: '11m ago', status: 'resolved' },
  { id: 3, type: 'Escalation',    detail: 'Case #00337 — Billing discrepancy',     time: '34m ago', status: 'escalated'},
  { id: 4, type: 'Case Created',  detail: 'Case #00336 — Login reset required',    time: '1h ago',  status: 'open'     },
  { id: 5, type: 'Case Resolved', detail: 'Case #00334 — Data export delivered',   time: '2h ago',  status: 'resolved' },
]

const STATUS_COLOURS = {
  open:      'var(--color-accent)',
  resolved:  'var(--color-success)',
  escalated: 'var(--color-danger)',
}

export default function Dashboard() {
  const { sfContext, ready, isEmbedded, showToast } = useSalesforceBridge()
  const [toastSent, setToastSent] = useState(false)

  function handleTestToast() {
    showToast('Success', 'React → Salesforce bridge working', 'success')
    setToastSent(true)
    setTimeout(() => setToastSent(false), 3000)
  }

  return (
    <div className={styles.page}>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Live service metrics and activity feed</p>
        </div>

        {isEmbedded && (
          <button
            className={`${styles.btn} ${toastSent ? styles.btnSuccess : ''}`}
            onClick={handleTestToast}
            disabled={!ready}
          >
            {toastSent ? '✓ Toast sent' : 'Test SF Bridge'}
          </button>
        )}
      </div>

      {/* SF Context banner — only shown when embedded */}
      {isEmbedded && sfContext && (
        <div className={styles.contextBanner}>
          <span className={styles.contextDot} />
          <span>Embedded in Salesforce · Record: <code>{sfContext.recordId}</code></span>
        </div>
      )}

      {/* Stats grid */}
      <section className={styles.statsGrid} aria-label="Key metrics">
        {STATS.map(stat => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      {/* Activity feed */}
      <section className={styles.activitySection}>
        <h2 className={styles.sectionTitle}>Recent Activity</h2>
        <div className={styles.activityList}>
          {ACTIVITY.map(item => (
            <div key={item.id} className={styles.activityItem}>
              <span
                className={styles.activityDot}
                style={{ background: STATUS_COLOURS[item.status] }}
                aria-hidden="true"
              />
              <div className={styles.activityBody}>
                <span className={styles.activityType}>{item.type}</span>
                <span className={styles.activityDetail}>{item.detail}</span>
              </div>
              <time className={styles.activityTime}>{item.time}</time>
            </div>
          ))}
        </div>
      </section>

      {/* Deploy info */}
      <section className={styles.deployInfo}>
        <h2 className={styles.sectionTitle}>Deployment</h2>
        <div className={styles.deployGrid}>
          <DeployItem label="Host"    value="AWS CloudFront + S3"         />
          <DeployItem label="Region"  value="ap-southeast-2 (Sydney)"     />
          <DeployItem label="Runtime" value={`Vite + React ${getReactVersion()}`} />
          <DeployItem label="Env"     value={import.meta.env.VITE_APP_ENV || 'development'} />
        </div>
      </section>

    </div>
  )
}

function DeployItem({ label, value }) {
  return (
    <div className={styles.deployItem}>
      <span className={styles.deployLabel}>{label}</span>
      <span className={styles.deployValue}>{value}</span>
    </div>
  )
}

function getReactVersion() {
  // Read from package.json via Vite define or just show 18
  return '18'
}
