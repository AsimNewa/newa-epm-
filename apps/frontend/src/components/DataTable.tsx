import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

interface DataTableProps<T> {
  rows: T[];
  columns: ColDef<T>[];
  loading?: boolean;
}

export function DataTable<T>({ rows, columns, loading }: DataTableProps<T>): JSX.Element {
  return (
    <div className="ag-theme-quartz h-[60vh] w-full">
      {loading ? (
        <p className="py-4 text-sm text-slate-500">Loading...</p>
      ) : (
        <AgGridReact<T>
          rowData={rows}
          columnDefs={columns}
          defaultColDef={{ resizable: true, sortable: true, filter: true }}
          animateRows
        />
      )}
    </div>
  );
}
