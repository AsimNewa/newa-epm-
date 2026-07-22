// AG Grid Enterprise — unlocks column tool panel, row grouping, column menus.
import 'ag-grid-enterprise';

import { useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { ImportResult, Role } from '@newa-epm/shared';
import { FormModal, type FormField } from '../components/FormModal';
import { ExportMenu } from '../components/ExportMenu';
import { GenericImportModal } from '../components/GenericImportModal';
import { exportGeneric } from '../lib/generic-format';
import type { ExportFormat } from '../lib/generic-format';
import { useImportRoles } from '../hooks/useBulkImport';
import {
  useCreateRole,
  useDeleteRole,
  usePermissions,
  useRoles,
  useSetRolePermissions,
  useUpdateRole,
} from '../hooks/useRoles';

// CreateRoleDto only supports name/description/mfaRequired — status changes go through inline
// grid editing (UpdateRoleDto) after a role exists, not through import.
const ROLE_HEADERS = ['name', 'description', 'mfaRequired'];

const ROLE_EXPORT_CONFIG = {
  headers: [...ROLE_HEADERS, 'status'],
  filenameBase: 'roles',
  sheetName: 'Roles',
  itemTag: 'role',
  rootTag: 'roles',
};

function roleToRow(role: Role): Record<string, unknown> {
  return {
    name: role.name,
    description: role.description ?? '',
    mfaRequired: role.mfaRequired,
    status: role.status,
  };
}

function rowToRoleDto(row: Record<string, unknown>): Record<string, unknown> {
  const dto: Record<string, unknown> = {};
  for (const h of ROLE_HEADERS) {
    if (h === 'mfaRequired') {
      const v = row[h];
      dto[h] = v === true || v === 'true' || v === '1' || v === 'yes' || v === 'Yes';
    } else if (row[h] !== '' && row[h] != null) {
      dto[h] = row[h];
    }
  }
  return dto;
}

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

const createFields: FormField[] = [
  { name: 'name', label: 'Name' },
  { name: 'description', label: 'Description' },
];

type RoleWithCount = Role & { _count?: { users: number } };

export function RolesPage(): JSX.Element {
  const { data: roles, isLoading } = useRoles();
  const { data: permissions } = usePermissions();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const setPermissions = useSetRolePermissions();

  const [modalMode, setModalMode] = useState<'create' | 'permissions' | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<RoleWithCount | null>(null);
  const [checkedPermissions, setCheckedPermissions] = useState<Set<string>>(new Set());

  const gridApiRef = useRef<GridApi | null>(null);
  const [gridReady, setGridReady] = useState(false);
  const importRoles = useImportRoles();

  const modules = useMemo(() => Array.from(new Set((permissions ?? []).map((p) => p.module))), [permissions]);
  const actions = useMemo(() => Array.from(new Set((permissions ?? []).map((p) => p.action))), [permissions]);

  const openPermissions = (role: RoleWithCount): void => {
    setActiveRole(role);
    setCheckedPermissions(new Set((role.permissions ?? []).map((rp) => rp.permissionId)));
    setModalMode('permissions');
  };

  const togglePermission = (permissionId: string): void => {
    setCheckedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const api = gridApiRef.current;
      if (!api) return;
      exportGeneric(format, api, roles ?? [], roleToRow, ROLE_EXPORT_CONFIG);
    },
    [roles],
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<RoleWithCount>) => {
      const row = event.data;
      if (!row) return;
      updateRole.mutate({
        id: row.id,
        dto: { name: row.name, description: row.description ?? undefined, status: row.status as 'active' | 'inactive' },
      });
    },
    [updateRole],
  );

  const columns = useMemo<ColDef<RoleWithCount>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 180,
        editable: (params) => !params.data?.isSystem,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        cellStyle: { fontWeight: 600 },
        cellRenderer: (params: { value: string; data: RoleWithCount | undefined }) =>
          params.data?.isSystem ? (
            <span>
              {params.value}{' '}
              <span
                className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                title="System role — name, description, and status cannot be changed"
              >
                System
              </span>
            </span>
          ) : (
            params.value
          ),
      },
      {
        field: 'description',
        headerName: 'Description',
        flex: 1,
        minWidth: 200,
        editable: (params) => !params.data?.isSystem,
        filter: 'agTextColumnFilter',
      },
      {
        headerName: 'Users',
        width: 90,
        editable: false,
        sortable: false,
        filter: false,
        valueGetter: (params) => params.data?._count?.users ?? 0,
      },
      {
        headerName: 'MFA Required',
        width: 130,
        editable: false,
        sortable: false,
        filter: false,
        cellRenderer: (params: { data: RoleWithCount }) => (
          <input
            type="checkbox"
            checked={params.data.mfaRequired}
            onChange={(e) => updateRole.mutate({ id: params.data.id, dto: { mfaRequired: e.target.checked } })}
          />
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        editable: (params) => !params.data?.isSystem,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['active', 'inactive'] },
        filter: 'agSetColumnFilter',
        cellClass: (params) => (params.value === 'active' ? 'text-green-700' : 'text-red-600'),
      },
      {
        colId: 'actions',
        headerName: 'Actions',
        pinned: 'right',
        width: 160,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: RoleWithCount | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <div className="flex gap-3 py-1">
              <button className="text-xs text-slate-600 hover:underline" onClick={() => openPermissions(data)}>
                Permissions
              </button>
              {!data.isSystem && (
                <button
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => {
                    if (confirm(`Delete role ${data.name}?`)) {
                      deleteRole.mutate(data.id);
                    }
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [deleteRole, updateRole],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-slate-800">Roles</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu onExport={handleExport} disabled={!gridReady} />
          <button
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setImportOpen(true)}
          >
            <span>⬆</span> Import
          </button>
          <button
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
            onClick={() => {
              setActiveRole(null);
              setModalMode('create');
            }}
          >
            + New Role
          </button>
        </div>
      </div>

      <div className="ag-theme-quartz rounded border border-slate-200" style={{ height: 'calc(100vh - 240px)', minHeight: 400 }}>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <AgGridReact<RoleWithCount>
            rowData={roles ?? []}
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
        title="New Role"
        open={modalMode === 'create'}
        onClose={() => setModalMode(null)}
        schema={createSchema}
        fields={createFields}
        onSubmit={(values) => {
          createRole.mutate(values, { onSuccess: () => setModalMode(null) });
        }}
      />

      <GenericImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Roles"
        standardFields={ROLE_HEADERS}
        helpText={<>System roles are protected — a row whose name matches an existing system role is rejected.</>}
        fromRow={rowToRoleDto}
        onImport={(rows) => importRoles.mutateAsync(rows) as Promise<ImportResult>}
      />

      {modalMode === 'permissions' && activeRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">
              Permissions for {activeRole.name}
              {activeRole.isSystem && <span className="ml-2 text-xs text-slate-500">(system role, read-only)</span>}
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b p-2 text-left">Module</th>
                  {actions.map((action) => (
                    <th key={action} className="border-b p-2 text-center capitalize">
                      {action}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module}>
                    <td className="border-b p-2 capitalize">{module}</td>
                    {actions.map((action) => {
                      const permission = (permissions ?? []).find((p) => p.module === module && p.action === action);
                      if (!permission) {
                        return <td key={action} className="border-b p-2 text-center">—</td>;
                      }
                      return (
                        <td key={action} className="border-b p-2 text-center">
                          <input
                            type="checkbox"
                            disabled={activeRole.isSystem}
                            checked={checkedPermissions.has(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setModalMode(null)}
              >
                Close
              </button>
              {!activeRole.isSystem && (
                <button
                  className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
                  onClick={() => {
                    setPermissions.mutate(
                      { id: activeRole.id, dto: { permissionIds: Array.from(checkedPermissions) } },
                      { onSuccess: () => setModalMode(null) },
                    );
                  }}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
