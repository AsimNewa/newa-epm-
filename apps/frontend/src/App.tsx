import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { EntitiesPage } from './pages/EntitiesPage';
import { ChartOfAccountsPage } from './pages/ChartOfAccountsPage';
import { CurrenciesPage } from './pages/CurrenciesPage';
import { DimensionsPage } from './pages/DimensionsPage';
import { AccountDimensionRulesPage } from './pages/AccountDimensionRulesPage';
import { OwnershipPage } from './pages/OwnershipPage';
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { CalendarPeriodsPage } from './pages/CalendarPeriodsPage';
import { ThemeSettingsPage } from './pages/ThemeSettingsPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';
import { CustomFieldsPage } from './pages/CustomFieldsPage';
import { RateTypesPage } from './pages/RateTypesPage';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/entities" replace />} />
        <Route path="/entities" element={<EntitiesPage />} />
        <Route path="/chart-of-accounts" element={<ChartOfAccountsPage />} />
        <Route path="/currencies" element={<CurrenciesPage />} />
        <Route path="/rate-types" element={<RateTypesPage />} />
        <Route path="/dimensions" element={<DimensionsPage />} />
        <Route path="/account-dimension-rules" element={<AccountDimensionRulesPage />} />
        <Route path="/ownership" element={<OwnershipPage />} />
        <Route path="/calendar" element={<CalendarPeriodsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/settings/theme" element={<ThemeSettingsPage />} />
        <Route path="/settings/system" element={<SystemSettingsPage />} />
        <Route path="/settings/custom-fields" element={<CustomFieldsPage />} />
      </Route>
    </Routes>
  );
}
