import { useTheme } from '../hooks/useTheme';

export function Logo({ className = 'h-8' }: { className?: string }): JSX.Element {
  const { data: theme } = useTheme();

  if (theme?.logoUrl) {
    return <img src={theme.logoUrl} alt="Company logo" className={`${className} w-auto object-contain`} />;
  }

  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path
          d="M6 14c6-8 14-8 18 0 4-8 12-8 18 0-6 0-10 4-14 10-2 3-2 6 0 9 4 6 8 10 14 10-6 8-14 8-18 0-4 8-12 8-18 0 6 0 10-4 14-10 2-3 2-6 0-9-4-6-8-10-14-10z"
          fill="var(--color-accent, #C9CED6)"
        />
      </svg>
      <span className="text-lg font-bold tracking-wide text-white">NEWA</span>
    </div>
  );
}
