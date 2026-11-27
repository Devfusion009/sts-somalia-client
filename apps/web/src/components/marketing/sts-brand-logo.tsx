/** Original supplied wordmark, including its lettering and two-tone tagline. */
export function StsBrandLogo({ white = false, className }: { white?: boolean; className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="145 34 535 278" width="535" height="278" role="img" aria-label="STS — Scout Travel Solution LTD" className={className}>
    {white ? <>
      <defs>
        <filter id="sts-footer-ink" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="-5" intercept="4.95" />
            <feFuncG type="linear" slope="-5" intercept="4.95" />
            <feFuncB type="linear" slope="-5" intercept="4.95" />
          </feComponentTransfer>
        </filter>
        <mask id="sts-footer-wordmark" maskUnits="userSpaceOnUse" x="0" y="0" width="749" height="349" style={{ maskType: "luminance" }}>
          <image href="/branding/sts-original-wordmark.png" width="749" height="349" filter="url(#sts-footer-ink)" />
        </mask>
      </defs>
      <path d="M0 0H749V349H0Z" fill="white" mask="url(#sts-footer-wordmark)" />
    </> : <image href="/branding/sts-original-wordmark.png" width="749" height="349" />}
  </svg>;
}
