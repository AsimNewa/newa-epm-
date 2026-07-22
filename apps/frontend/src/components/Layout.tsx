import { NavLink, Outlet } from 'react-router-dom';
import { TenantBanner } from './TenantBanner';
import { PeriodBanner } from './PeriodBanner';
import { UserContextBanner } from './UserContextBanner';
import { Logo } from './Logo';

const navItems = [
  { to: '/entities', label: 'Entities' },
  { to: '/chart-of-accounts', label: 'Chart of Accounts' },
  { to: '/currencies', label: 'Currencies' },
  { to: '/rate-types', label: 'Rate Types' },
  { to: '/dimensions', label: 'Dimensions' },
  { to: '/account-dimension-rules', label: 'Account ↔ Dimension Rules' },
  { to: '/ownership', label: 'Ownership Structure' },
  { to: '/calendar', label: 'Calendar & Periods' },
  { to: '/users', label: 'Users' },
  { to: '/roles', label: 'Roles & Permissions' },
  { to: '/settings/theme', label: 'Theme Settings' },
  { to: '/settings/system', label: 'System Settings' },
  { to: '/settings/custom-fields', label: 'Custom Fields' },
];

export function Layout(): JSX.Element {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TenantBanner />
      <PeriodBanner />
      <UserContextBanner />
      <div className="flex min-h-0 flex-1">
        <nav className="w-60 overflow-y-auto bg-brand-primary p-4">
          <div className="mb-6 px-1">
            <Logo />
          </div>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block rounded px-3 py-2 text-sm transition-colors ${
                      isActive ? 'bg-brand-accent text-brand-primary font-medium' : 'text-white/80 hover:bg-white/10'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 p-6 text-slate-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
