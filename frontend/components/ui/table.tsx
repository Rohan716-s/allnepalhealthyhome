"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/table-pagination";
import { useTablePagination } from "@/hooks/use-table-pagination";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, children, ...props }, ref) => {
  const tableChildren = React.Children.toArray(children);
  const bodyIndex = tableChildren.findIndex((child) => React.isValidElement(child) && child.type === TableBody);
  const body = bodyIndex >= 0 && React.isValidElement(tableChildren[bodyIndex]) ? tableChildren[bodyIndex] : null;
  const bodyRows = body ? React.Children.toArray((body.props as { children?: React.ReactNode }).children) : [];
  const pagination = useTablePagination(bodyRows);
  const nextChildren = body
    ? tableChildren.map((child, index) => index === bodyIndex ? React.cloneElement(body, undefined, pagination.pageItems) : child)
    : tableChildren;
  return <div className="table-scroll-container relative w-full"><table ref={ref} data-anhh-paginated="true" className={cn("w-full caption-bottom text-sm", className)} {...props}>{nextChildren}</table><TablePagination page={pagination.page} pageSize={pagination.pageSize} totalItems={pagination.totalItems} totalPages={pagination.totalPages} onPageChange={pagination.goToPage} /></div>;
});
Table.displayName = "Table";
const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-slate-100 dark:[&_tr]:border-slate-800 dark:bg-slate-900/60", className)} {...props} />);
TableHeader.displayName = "TableHeader";
const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />);
TableBody.displayName = "TableBody";
const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => <tr ref={ref} className={cn("border-b border-slate-100 transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/50", className)} {...props} />);
TableRow.displayName = "TableRow";
const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => <th ref={ref} className={cn("h-10 px-3 text-left align-middle text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500", className)} {...props} />);
TableHead.displayName = "TableHead";
const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => <td ref={ref} className={cn("p-3 align-middle text-xs", className)} {...props} />);
TableCell.displayName = "TableCell";
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
