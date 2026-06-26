import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { format, addSeconds } from 'date-fns'
import { Activity, ShieldAlert, Trash2, CheckSquare, Square, ChevronLeft, ChevronRight } from 'lucide-react'

import { activityLog } from '@/lib/api'
import type { BrowserActivityLog } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'

export function ActivityLogPage() {
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })
  
  const [domainFilter, setDomainFilter] = useState('')
  const [dateFilter, setDateFilter] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const { data, isLoading } = useQuery({
    queryKey: ['activityLog', pagination.pageIndex, pagination.pageSize, domainFilter, dateFilter],
    queryFn: () => activityLog.list({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      domain: domainFilter || undefined,
      date: dateFilter || undefined,
    }),
  })

  const toggleSelectionMutation = useMutation({
    mutationFn: ({ id, selected }: { id: string, selected: boolean }) =>
      activityLog.updateSelected(id, selected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityLog'] })
    },
  })

  const bulkSelectMutation = useMutation({
    mutationFn: (selected: boolean) =>
      activityLog.bulkSelect(selected, domainFilter || undefined, dateFilter || undefined),
    onSuccess: (res) => {
      toast.success(`Updated ${res.updatedCount} logs`)
      queryClient.invalidateQueries({ queryKey: ['activityLog'] })
    },
  })

  const promoteMutation = useMutation({
    mutationFn: () => activityLog.promote(dateFilter || undefined),
    onSuccess: (res) => {
      toast.success(`Promoted ${res.promotedCount} selected logs to Activity Events`)
      queryClient.invalidateQueries({ queryKey: ['activityLog'] })
    },
  })

  const columns: ColumnDef<BrowserActivityLog>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => {
            bulkSelectMutation.mutate(e.target.checked)
          }}
        />
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          {row.original.promotedToEventId ? (
            <Badge variant="secondary" className="text-[10px]">Promoted</Badge>
          ) : (
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={row.original.selected}
              onChange={(e) => {
                toggleSelectionMutation.mutate({ id: row.original.id, selected: e.target.checked })
              }}
            />
          )}
        </div>
      ),
      size: 40,
    },
    {
      accessorKey: 'tabOpenedAt',
      header: 'Start - End',
      cell: ({ row }) => {
        const start = new Date(row.original.tabOpenedAt)
        const end = addSeconds(start, row.original.durationSeconds)
        return <div className="text-sm whitespace-nowrap">{format(start, 'HH:mm')} - {format(end, 'HH:mm')}</div>
      },
      size: 110,
    },
    {
      accessorKey: 'durationSeconds',
      header: 'Duration',
      cell: ({ row }) => {
        const secs = row.original.durationSeconds
        if (secs < 60) return <div className="text-sm text-muted-foreground">{secs}s</div>
        const mins = Math.floor(secs / 60)
        return <div className="text-sm font-medium">{mins}m {secs % 60}s</div>
      },
      size: 80,
    },
    {
      accessorKey: 'domain',
      header: 'Domain',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <img 
            src={`https://www.google.com/s2/favicons?domain=${row.original.domain}&sz=32`} 
            className="w-4 h-4 rounded-sm"
            alt=""
          />
          <span className="text-sm font-medium">{row.original.domain}</span>
          {row.original.captureTier === 1 && (
            <Badge variant="outline" className="text-[10px] ml-1 bg-blue-500/10 text-blue-500">Tier 1</Badge>
          )}
          {row.original.captureTier === 2 && (
            <Badge variant="outline" className="text-[10px] ml-1 bg-purple-500/10 text-purple-500">Tier 2</Badge>
          )}
        </div>
      ),
      size: 200,
    },
    {
      accessorKey: 'pageTitle',
      header: 'Page & Details',
      cell: ({ row }) => {
        let detailNode = null;
        if (row.original.captureTier === 1 && row.original.snapshotText) {
          const text = row.original.snapshotText.replace(/\s+/g, ' ').substring(0, 100);
          detailNode = <div className="text-xs text-muted-foreground mt-1 truncate max-w-sm" title={row.original.snapshotText}>Snippet: {text}...</div>;
        } else if (row.original.captureTier === 2 && row.original.adapterPayload) {
          const payload = row.original.adapterPayload as any;
          if (payload.title) {
            detailNode = <div className="text-xs text-muted-foreground mt-1 truncate max-w-sm">Conversation: {payload.title}</div>;
          } else if (payload.messages && payload.messages.length > 0) {
            detailNode = <div className="text-xs text-muted-foreground mt-1 truncate max-w-sm">Exchanged {payload.messages.length} messages</div>;
          }
        }
        
        return (
          <div className="flex flex-col">
            <div className="text-sm font-medium truncate max-w-md" title={row.original.pageTitle}>
              {row.original.pageTitle || 'Untitled Page'}
            </div>
            {detailNode}
          </div>
        );
      },
    },
  ]

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    pageCount: data?.meta.totalPages ?? -1,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    manualPagination: true,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Radar</h1>
          <p className="text-muted-foreground">Review and select captured browser activity for your reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="default" 
            onClick={() => promoteMutation.mutate()}
            disabled={promoteMutation.isPending}
          >
            Promote Selected to Report
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <Input 
          type="date" 
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-40"
        />
        <Input
          placeholder="Filter by domain..."
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="max-w-xs"
        />
        <div className="ml-auto text-sm text-muted-foreground">
          Showing {data?.data.length || 0} of {data?.meta.total || 0} activities
        </div>
      </div>

      <Card className="rounded-md border overflow-hidden">
        <div className="w-full overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="h-10 px-4 font-medium text-muted-foreground align-middle" style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    Loading activity logs...
                  </td>
                </tr>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-4 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No activity found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
