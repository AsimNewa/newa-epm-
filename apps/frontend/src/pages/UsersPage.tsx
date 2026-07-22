// AG Grid Enterprise — unlocks column tool panel, row grouping, column menus.
import 'ag-grid-enterprise';

import { useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { User } from '@newa-epm/shared';
import { FormModal, type FormField } from '../components/FormModal';
import { ExportMenu } from '../components/ExportMenu';
import { useRoles } from '../hooks/useRoles';
import { useEntities } from '../hooks/useEntities';
import { useConsolidationGroups } from '../hooks/useOwnership';
import { exportGeneric } from '../lib/generic-format';
import type { ExportFormat } from '../lib/generic-format';
import {
  useAssignUserRole,
  useCreateUser,
  useDeleteUser,
  useRemoveUserRole,
  useUpdateUser,
  useUsers,
} from '../hooks/useUsers';

const USER_HEADERS = ['fullName', 'email', 'username', 'status', 'roles'];

const USER_EXPORT_CONFIG = {
  headers: USER_HEADERS,
  filenameBase: 'users',
  sheetName: 'Users',
  itemTag: 'user',
  rootTag: 'users',
};

function userToRow(user: User): Record<string, unknown> {
  return {
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    status: user.status,
    roles: (user.roles ?? []).map((r) => r.role?.name).filter(Boolean).join(', '),
  };
}

const createSchema = z.object({
  email: z.string().email('Valid email required'),
  username: z.string().min(1, 'Username is required'),
  fullName: z.string().min(1, 'Full name is required'),
  password: z.string().min(8, 'Minimum 8 characters'),
  roleId: z.string().optional(),
});


export function UsersPage(): JSX.Element {
  const { data: users, isLoading } = useUsers();
  const { data: roles } = useRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const assignRole = useAssignUserRole();
  const removeRole = useRemoveUserRole();
  const { data: entities } = useEntities();
  const { data: groups } = useConsolidationGroups();

  const [modalMode, setModalMode] = useState<'create' | 'roles' | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [roleToAdd, setRoleToAdd] = useState('');
  const [selectedEntityScope, setSelectedEntityScope] = useState<string[]>([]);
  const [selectedGroupScope, setSelectedGroupScope] = useState<string[]>([]);

  const gridApiRef = useRef<GridApi | null>(null);
  const [gridReady, setGridReady] = useState(false);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const api = gridApiRef.current;
      if (!api) return;
      exportGeneric(format, api, users ?? [], userToRow, USER_EXPORT_CONFIG);
    },
    [users],
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<User>) => {
      const row = event.data;
      if (!row) return;
      updateUser.mutate({
        id: row.id,
        dto: { fullName: row.fullName, username: row.username, status: row.status },
      });
    },
    [updateUser],
  );

  const createFields: FormField[] = useMemo(
    () => [
      { name: 'email', label: 'Email' },
      { name: 'username', label: 'Username' },
      { name: 'fullName', label: 'Full Name' },
      { name: 'password', label: 'Password' },
      {
        name: 'roleId',
        label: 'Initial Role',
        type: 'select',
        options: [
          { label: '(none)', value: '' },
          ...(roles ?? []).map((role) => ({ label: role.name, value: role.id })),
        ],
      },
    ],
    [roles],
  );

  const columns = useMemo<ColDef<User>[]>(
    () => [
      {
        field: 'fullName',
        headerName: 'Name',
        flex: 1,
        minWidth: 180,
        editable: true,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        cellStyle: { fontWeight: 600 },
      },
      { field: 'email', headerName: 'Email', flex: 1, minWidth: 200, editable: false, filter: 'agTextColumnFilter' },
      { field: 'username', headerName: 'Username', width: 160, editable: true, filter: 'agTextColumnFilter' },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['active', 'inactive', 'locked'] },
        filter: 'agSetColumnFilter',
        cellClass: (params) => (params.value === 'active' ? 'text-green-700' : 'text-red-600'),
      },
      {
        headerName: 'Roles',
        flex: 1,
        minWidth: 180,
        editable: false,
        sortable: false,
        filter: false,
        valueGetter: (params) => (params.data?.roles ?? []).map((r) => r.role?.name).join(', '),
      },
      {
        colId: 'actions',
        headerName: 'Actions',
        pinned: 'right',
        width: 160,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: User | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <div className="flex gap-3 py-1">
              <button
                className="text-xs text-slate-600 hover:underline"
                onClick={() => {
                  setActiveUser(data);
                  setModalMode('roles');
                }}
              >
                Roles
              </button>
              <button
                className="text-xs text-red-600 hover:underline"
                onClick={() => {
                  if (confirm(`Delete user ${data.email}?`)) {
                    deleteUser.mutate(data.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [deleteUser],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-slate-800">Users</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu onExport={handleExport} disabled={!gridReady} />
          <button
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
            onClick={() => {
              setActiveUser(null);
              setModalMode('create');
            }}
          >
            + New User
          </button>
        </div>
      </div>

      <div className="ag-theme-quartz rounded border border-slate-200" style={{ height: 'calc(100vh - 240px)', minHeight: 400 }}>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <AgGridReact<User>
            rowData={users ?? []}
            columnDefs={columns}
            defaultColDef={{ resizable: true, sortable: true, filter: true }}
            sideBar={{
              toolPanels: [
                { id: 'columns', labelDefault: 'Columns', labelKey: 'columns', iconKey: 'columns', toolPanel: 'agColumnsToolPanel' },
                { id: 'filters', labelDefault: 'Filters', labelKey: 'filters', iconKey: 'filter', toolPanel: 'agFiltersToolPanel' },
              ],
            }}
            onCellValueChanged={onCellValueChanged}
            stopEditingWhenCellsLoseFocus
            enterNavigatesVertically
            enterNavigatesVerticallyAfterEdit
            animateRows
            onGridReady={(e: GridReadyEvent) => { gridApiRef.current = e.api; setGridReady(true); }}
            rowSelection="multiple"
            suppressRowClickSelection
          />
        )}
      </div>

      <FormModal
        title="New User"
        open={modalMode === 'create'}
        onClose={() => setModalMode(null)}
        schema={createSchema}
        fields={createFields}
        onSubmit={(values) => {
          const dto = { ...values, roleId: values.roleId || undefined };
          createUser.mutate(dto, { onSuccess: () => setModalMode(null) });
        }}
      />

      {modalMode === 'roles' && activeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Roles for {activeUser.fullName}</h2>
            <ul className="mb-4 space-y-2">
              {(activeUser.roles ?? []).map((userRole) => (
                <li key={userRole.roleId} className="flex items-center justify-between text-sm">
                  <span>{userRole.role?.name}</span>
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() =>
                      removeRole.mutate({ userId: activeUser.id, roleId: userRole.roleId })
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
              {(activeUser.roles ?? []).length === 0 && (
                <li className="text-sm text-slate-500">No roles assigned</li>
              )}
            </ul>
            <div className="space-y-2">
              <select
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={roleToAdd}
                onChange={(e) => setRoleToAdd(e.target.value)}
              >
                <option value="">Select a role...</option>
                {(roles ?? []).map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-600">
                  Entity scope (empty = all)
                  <select
                    multiple
                    size={3}
                    className="mt-1 w-full rounded border border-slate-300 px-1 py-1 text-xs"
                    value={selectedEntityScope}
                    onChange={(e) =>
                      setSelectedEntityScope(Array.from(e.target.selectedOptions).map((o) => o.value))
                    }
                  >
                    {(entities ?? []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.code} — {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Group scope (empty = all)
                  <select
                    multiple
                    size={3}
                    className="mt-1 w-full rounded border border-slate-300 px-1 py-1 text-xs"
                    value={selectedGroupScope}
                    onChange={(e) =>
                      setSelectedGroupScope(Array.from(e.target.selectedOptions).map((o) => o.value))
                    }
                  >
                    {(groups ?? []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.code} — {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="w-full rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
                disabled={!roleToAdd}
                onClick={() => {
                  assignRole.mutate({
                    userId: activeUser.id,
                    dto: {
                      roleId: roleToAdd,
                      entityScope: selectedEntityScope.length > 0 ? selectedEntityScope : undefined,
                      groupScope: selectedGroupScope.length > 0 ? selectedGroupScope : undefined,
                    },
                  });
                  setRoleToAdd('');
                  setSelectedEntityScope([]);
                  setSelectedGroupScope([]);
                }}
              >
                Assign with scope
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setModalMode(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
