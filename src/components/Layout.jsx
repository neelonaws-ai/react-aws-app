import { Outlet, NavLink, useLocation } from 'react-router-dom'
import styles from './Layout.module.css'

const NAV_ITEMS = [
  { to: '/',      label: 'Dashboard' },
  { to: '/about', label: 'About'     },
]

export default function Layout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect width="10" height="10" rx="2" fill="var(--color-accent)"/>
              <rect x="14" width="10" height="10" rx="2" fill="var(--color-accent)" opacity="0.5"/>
              <rect y="14" width="10" height="10" rx="2" fill="var(--color-accent)" opacity="0.5"/>
              <rect x="14" y="14" width="10" height="10" rx="2" fill="var(--color-accent)" opacity="0.25"/>
            </svg>
            <span className={styles.logoText}>MyApp</span>
          </div>

          <nav className={styles.nav} aria-label="Main navigation">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className={styles.headerMeta}>
            <EnvBadge />
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <span>Deployed on AWS S3 + CloudFront</span>
        <span className={styles.footerDot}>·</span>
        <span>Region: ap-southeast-2</span>
      </footer>
    </div>
  )
}

function EnvBadge() {
  const env = import.meta.env.VITE_APP_ENV || 'development'
  const isProd = env === 'production'
  return (
    <span
      className={styles.envBadge}
      style={{ '--badge-color': isProd ? 'var(--color-success)' : 'var(--color-warning)' }}
    >
      {env}
    </span>
  )
}
