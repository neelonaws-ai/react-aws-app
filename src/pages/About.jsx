import styles from './About.module.css'

const STACK = [
  { name: 'React 18',        role: 'UI framework',         href: 'https://react.dev' },
  { name: 'React Router 6',  role: 'Client-side routing',  href: 'https://reactrouter.com' },
  { name: 'Vite 5',          role: 'Build tool',           href: 'https://vitejs.dev' },
  { name: 'AWS S3',          role: 'Static asset storage',  href: 'https://aws.amazon.com/s3/' },
  { name: 'AWS CloudFront',  role: 'CDN + HTTPS',          href: 'https://aws.amazon.com/cloudfront/' },
  { name: 'AWS ACM',         role: 'SSL certificate',       href: 'https://aws.amazon.com/certificate-manager/' },
  { name: 'GitHub Actions',  role: 'CI/CD pipeline',        href: 'https://github.com/features/actions' },
]

const ARCH_STEPS = [
  { step: '01', title: 'Build',   detail: 'Vite compiles React into hashed static files in dist/' },
  { step: '02', title: 'Upload',  detail: 'GitHub Actions syncs dist/ to S3 with correct cache headers' },
  { step: '03', title: 'Serve',   detail: 'CloudFront CDN serves files globally over HTTPS' },
  { step: '04', title: 'Embed',   detail: 'Salesforce LWC loads the CloudFront URL in an iframe' },
  { step: '05', title: 'Bridge',  detail: 'postMessage carries context and events between SF and React' },
]

export default function About() {
  return (
    <div className={styles.page}>

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>About this app</h1>
        <p className={styles.subtitle}>
          A React SPA hosted on AWS S3 + CloudFront, designed to be embedded
          inline in a Salesforce Experience Cloud site via iframe.
        </p>
      </div>

      <section>
        <h2 className={styles.sectionTitle}>Architecture</h2>
        <div className={styles.archList}>
          {ARCH_STEPS.map(({ step, title, detail }) => (
            <div key={step} className={styles.archItem}>
              <span className={styles.archStep}>{step}</span>
              <div className={styles.archBody}>
                <span className={styles.archTitle}>{title}</span>
                <span className={styles.archDetail}>{detail}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Stack</h2>
        <div className={styles.stackGrid}>
          {STACK.map(({ name, role, href }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.stackCard}
            >
              <span className={styles.stackName}>{name}</span>
              <span className={styles.stackRole}>{role}</span>
            </a>
          ))}
        </div>
      </section>

    </div>
  )
}
